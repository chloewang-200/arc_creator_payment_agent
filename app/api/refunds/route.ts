import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { ARC_CHAIN_ID, ARC_RPC_URL, USDC_DECIMALS } from '@/lib/config';
import { USDC_ABI } from '@/lib/contracts';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import * as chains from 'viem/chains';
import { canProcessRefund as canProcessPrivyRefund } from '@/lib/privy-refund-wallet';
import { canProcessRefund as canProcessCircleRefund } from '@/lib/circle-refund-wallet';

// Helper to revoke access based on refund type
async function revokeAccess(
  refundType: string,
  transactionId: string,
  userWalletAddress: string,
  creatorId: string
) {
  if (refundType === 'unlock' && transactionId) {
    let deleted = false;
    const { data: postUnlock, error: unlockError } = await supabaseAdmin
      .from('post_unlocks')
      .select('post_id, id')
      .or(`id.eq.${transactionId},transaction_hash.eq.${transactionId}`)
      .eq('wallet_address', userWalletAddress.toLowerCase())
      .maybeSingle();

    if (!unlockError && postUnlock) {
      const { error: deleteError } = await supabaseAdmin
        .from('post_unlocks')
        .delete()
        .eq('id', postUnlock.id)
        .eq('wallet_address', userWalletAddress.toLowerCase());

      if (!deleteError) {
        deleted = true;
        console.log(`✅ Revoked post unlock for post ${postUnlock.post_id}`);
      }
    }

    if (!deleted) {
      const { error: deleteError, count } = await supabaseAdmin
        .from('post_unlocks')
        .delete()
        .eq('post_id', transactionId)
        .eq('wallet_address', userWalletAddress.toLowerCase());

      if (!deleteError && count && count > 0) {
        console.log(`✅ Revoked post unlock for post ${transactionId}`);
      }
    }
  } else if (refundType === 'subscription') {
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('creator_id', creatorId)
      .eq('wallet_address', userWalletAddress.toLowerCase());

    if (!error) {
      console.log(`✅ Revoked subscription for creator ${creatorId}`);
    }
  } else if (refundType === 'recurringTip') {
    const { error } = await supabaseAdmin
      .from('recurring_tips')
      .delete()
      .eq('creator_id', creatorId)
      .eq('wallet_address', userWalletAddress.toLowerCase());

    if (!error) {
      console.log(`✅ Revoked recurring tip for creator ${creatorId}`);
    }
  }
}

// POST /api/refunds - Process a refund request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creatorId,
      userWalletAddress,
      transactionId,
      refundType,
      amountUSD,
      chainId,
    } = body;

    if (!creatorId || !userWalletAddress || !transactionId || !refundType || !amountUSD) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Tips cannot be refunded
    if (refundType === 'tip' || refundType === 'recurringTip') {
      return NextResponse.json(
        {
          error: 'Tips cannot be refunded',
          reason: 'Tips are voluntary contributions and are non-refundable. Only purchased content (unlocks and subscriptions) can be refunded.',
        },
        { status: 403 }
      );
    }

    // Get creator's refund settings
    const { data: pricing, error: pricingError } = await supabase
      .from('creator_pricing')
      .select('refund_conversation_threshold, refund_auto_threshold_usd, refund_contact_email')
      .eq('creator_id', creatorId)
      .single();

    if (pricingError || !pricing) {
      return NextResponse.json(
        { error: 'Creator pricing not found' },
        { status: 404 }
      );
    }

    // Note: Refund eligibility is now checked by the AI agent based on refund intent attempts
    // The agent tracks attempts locally and processes refunds after the threshold
    // This API endpoint is called by the agent after the threshold is met

    // Check if amount is above auto-refund threshold
    const autoThreshold = pricing.refund_auto_threshold_usd || 1.00;
    if (amountUSD > autoThreshold) {
      return NextResponse.json(
        {
          error: `Refund requires manual approval, please contact ${pricing.refund_contact_email || 'the creator'} for assistance.`,
          reason: `Refunds above $${autoThreshold} require manual approval. Please contact ${pricing.refund_contact_email || 'the creator'} for assistance.`,
          contactEmail: pricing.refund_contact_email,
          autoThreshold,
        },
        { status: 403 }
      );
    }

    // Try automated Circle refund first (preferred method)
    const circleEligibility = await canProcessCircleRefund(creatorId, amountUSD);
    if (circleEligibility.canProcess) {
      try {
        console.log('[Refund] Attempting automated Circle refund for', amountUSD);

        // Create refund record first - use supabaseAdmin to bypass RLS
        const refundData: any = {
          creator_id: creatorId,
          user_wallet_address: userWalletAddress.toLowerCase(),
          original_transaction_id: transactionId,
          refund_type: refundType,
          original_amount_usd: amountUSD,
          refund_amount_usd: amountUSD, // No fee for automated refunds
          fee_amount_usd: 0,
          status: 'processing',
        };
        
        // Add chain_id if available (column might not exist in older schemas)
        if (chainId) {
          refundData.chain_id = chainId;
        }
        
        const { data: refund, error: refundError } = await supabaseAdmin
          .from('refunds')
          .insert(refundData)
          .select()
          .single();
        
        if (refundError || !refund) {
          console.error('[Refund] Failed to create refund record:', refundError);
          // If error is about missing chain_id column, provide helpful message
          if (refundError?.message?.includes('chain_id')) {
            throw new Error('Database schema missing chain_id column. Please run migration: migrations/add_chain_id_to_refunds.sql');
          }
          throw new Error('Failed to create refund record');
        }

        // Call the Circle refund processing endpoint
        const circleRefundResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/refunds/circle/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refundId: refund.id,
            creatorId,
            userAddress: userWalletAddress,
            amountUSD,
          }),
        });

        const circleRefundData = await circleRefundResponse.json();

        if (circleRefundResponse.ok && circleRefundData.success) {
          console.log('[Refund] Circle automated refund succeeded!', circleRefundData.transactionHash);

          // Revoke access
          await revokeAccess(refundType, transactionId, userWalletAddress, creatorId);

          // Automated refund succeeded via Circle
          return NextResponse.json({
            success: true,
            refund: {
              id: refund.id,
              transactionHash: circleRefundData.transactionHash,
              challengeId: circleRefundData.challengeId, // Include Circle transaction ID
              refundAmount: amountUSD,
              status: 'completed',
              message: `Refund of $${amountUSD.toFixed(2)} has been automatically processed! USDC has been sent to your wallet. Access has been revoked.`,
              automated: true,
            },
          });
        } else {
          console.log('[Refund] Circle automated refund failed, trying Privy:', circleRefundData.error);
          // Mark refund as failed
          await supabaseAdmin
            .from('refunds')
            .update({ status: 'failed', rejection_reason: circleRefundData.error })
            .eq('id', refund.id);
          // Fall through to Privy
        }
      } catch (error) {
        console.error('[Refund] Error calling Circle refund API, trying Privy:', error);
        // Fall through to Privy
      }
    } else {
      console.log('[Refund] Creator not eligible for Circle automated refunds:', circleEligibility.reason);
    }

    // Try automated Privy refund as fallback
    const privyEligibility = await canProcessPrivyRefund(creatorId, amountUSD);
    if (privyEligibility.canProcess) {
      try {
        console.log('[Refund] Attempting automated Privy refund for', amountUSD);
        // Call the Privy refund processing endpoint
        const privyRefundResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/refunds/privy/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creatorId,
            userWalletAddress,
            transactionId,
            refundType,
            amountUSD,
            chainId,
          }),
        });

        const privyRefundData = await privyRefundResponse.json();

        if (privyRefundResponse.ok && privyRefundData.success) {
          console.log('[Refund] Privy automated refund succeeded!');
          // Automated refund succeeded via Privy
          return NextResponse.json({
            success: true,
            refund: privyRefundData.refund,
          });
        } else {
          console.log('[Refund] Privy automated refund failed, falling back to manual approval:', privyRefundData.error);
          // Fall through to manual approval process
        }
      } catch (error) {
        console.error('[Refund] Error calling Privy refund API, falling back to manual approval:', error);
        // Fall through to manual approval process
      }
    } else {
      console.log('[Refund] Creator not eligible for Privy automated refunds:', privyEligibility.reason);
      // Fall through to manual approval process
    }

    // Calculate refund amount (minus fees - e.g., 2% fee)
    const feePercentage = 0.02; // 2% fee
    const feeAmount = amountUSD * feePercentage;
    const refundAmount = amountUSD - feeAmount;

    // Get creator's wallet address
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('wallet_address')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator?.wallet_address) {
      return NextResponse.json(
        { error: 'Creator wallet not found' },
        { status: 404 }
      );
    }

    // Create refund record - use supabaseAdmin to bypass RLS
    const refundData: any = {
      creator_id: creatorId,
      user_wallet_address: userWalletAddress.toLowerCase(),
      original_transaction_id: transactionId,
      refund_type: refundType,
      original_amount_usd: amountUSD,
      refund_amount_usd: refundAmount,
      fee_amount_usd: feeAmount,
      status: 'pending', // Requires creator approval
    };
    
    // Add chain_id if available (column might not exist in older schemas)
    if (chainId) {
      refundData.chain_id = chainId;
    }
    
    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .insert(refundData)
      .select()
      .single();

    if (refundError) {
      // If error is about missing chain_id column, provide helpful message
      if (refundError?.message?.includes('chain_id')) {
        return NextResponse.json(
          { error: 'Database schema missing chain_id column. Please run migration: migrations/add_chain_id_to_refunds.sql', details: refundError.message },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to create refund record', details: refundError.message },
        { status: 500 }
      );
    }

    // Revoke access based on refund type
    await revokeAccess(refundType, transactionId, userWalletAddress, creatorId);

    // Note: On-chain refund processing requires the creator's wallet signature
    // This is handled client-side via the PendingRefunds component in the creator dashboard
    // The refund record is created with status 'pending' and will be updated
    // once the creator approves and the transaction is confirmed

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        refundAmount,
        feeAmount,
        originalAmount: amountUSD,
        status: 'pending', // Changed to 'pending' - requires creator approval
        refundType: refundType,
        chainId: chainId,
        message: `Refund request created. The creator will review and approve this refund. Access has been revoked.`,
        requiresApproval: true,
      },
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}

// GET /api/refunds - Get refund status or history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const refundId = searchParams.get('id');
    const creatorId = searchParams.get('creatorId');
    const userWalletAddress = searchParams.get('userWalletAddress');

    if (refundId) {
      // Get specific refund
      const { data: refund, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('id', refundId)
        .single();

      if (error) throw error;
      return NextResponse.json({ refund });
    }

    // Get refunds for a creator (with optional status filter)
    if (creatorId) {
      const statusParam = searchParams.get('status');
      let query = supabase
        .from('refunds')
        .select('*')
        .eq('creator_id', creatorId);

      // Filter by status if provided (can be comma-separated list)
      if (statusParam) {
        const statuses = statusParam.split(',').map(s => s.trim());
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      // Filter by user wallet if provided
      if (userWalletAddress) {
        query = query.eq('user_wallet_address', userWalletAddress.toLowerCase());
      }

      query = query.order('created_at', { ascending: false });

      const { data: refunds, error } = await query;

      if (error) throw error;
      return NextResponse.json({ refunds });
    }

    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error fetching refunds:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch refunds' },
      { status: 500 }
    );
  }
}

