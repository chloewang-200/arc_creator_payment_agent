import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createPublicClient, http, formatUnits, parseUnits } from 'viem';
import { ARC_CHAIN_ID, ARC_RPC_URL, USDC_DECIMALS } from '@/lib/config';
import { USDC_ABI } from '@/lib/contracts';
import { getGatewayUSDCAddress } from '@/lib/gateway';
import * as chains from 'viem/chains';
import { canProcessRefund } from '@/lib/privy-refund-wallet';

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
          error: 'Refund requires manual approval',
          reason: `Refunds above $${autoThreshold} require manual approval. Please contact ${pricing.refund_contact_email || 'the creator'} for assistance.`,
          contactEmail: pricing.refund_contact_email,
          autoThreshold,
        },
        { status: 403 }
      );
    }

    // Try automated Privy refund first
    const eligibility = await canProcessRefund(creatorId, amountUSD);
    if (eligibility.canProcess) {
      try {
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
          // Automated refund succeeded via Privy
          return NextResponse.json({
            success: true,
            refund: privyRefundData.refund,
          });
        } else {
          console.log('Automated Privy refund failed, falling back to manual approval:', privyRefundData.error);
          // Fall through to manual approval process
        }
      } catch (error) {
        console.error('Error calling Privy refund API, falling back to manual approval:', error);
        // Fall through to manual approval process
      }
    } else {
      console.log('Creator not eligible for automated refunds:', eligibility.reason);
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

    // Create refund record
    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        creator_id: creatorId,
        user_wallet_address: userWalletAddress.toLowerCase(),
        original_transaction_id: transactionId,
        refund_type: refundType,
        original_amount_usd: amountUSD,
        refund_amount_usd: refundAmount,
        fee_amount_usd: feeAmount,
        status: 'pending', // Requires creator approval
        chain_id: chainId,
      })
      .select()
      .single();

    if (refundError) {
      return NextResponse.json(
        { error: 'Failed to create refund record', details: refundError.message },
        { status: 500 }
      );
    }

    // Revoke access based on refund type
    if (refundType === 'unlock' && transactionId) {
      // For unlock refunds, we need to find and delete the post_unlock record
      // The transactionId could be:
      // 1. post_unlocks.id (UUID)
      // 2. transaction_hash (tx hash)
      // 3. post_id (UUID) - fallback
      
      let deleted = false;
      
      // First, try to find the post_unlock record by ID or transaction hash
      const { data: postUnlock, error: unlockError } = await supabase
        .from('post_unlocks')
        .select('post_id, id')
        .or(`id.eq.${transactionId},transaction_hash.eq.${transactionId}`)
        .eq('wallet_address', userWalletAddress.toLowerCase())
        .maybeSingle();

      if (!unlockError && postUnlock) {
        // Delete by the found record ID
        const { error: deleteError } = await supabase
          .from('post_unlocks')
          .delete()
          .eq('id', postUnlock.id)
          .eq('wallet_address', userWalletAddress.toLowerCase());

        if (!deleteError) {
          deleted = true;
          console.log(`✅ Revoked post unlock for post ${postUnlock.post_id} and wallet ${userWalletAddress}`);
        } else {
          console.error('Error revoking post unlock:', deleteError);
        }
      }
      
      // If not found by ID/hash, try using transactionId as postId directly
      if (!deleted) {
        const { error: deleteError, count } = await supabase
          .from('post_unlocks')
          .delete()
          .eq('post_id', transactionId)
          .eq('wallet_address', userWalletAddress.toLowerCase());

        if (!deleteError && count && count > 0) {
          deleted = true;
          console.log(`✅ Revoked post unlock for post ${transactionId} and wallet ${userWalletAddress}`);
        } else if (!deleted) {
          console.warn(`⚠️ Could not find post unlock to revoke for transactionId: ${transactionId}, wallet: ${userWalletAddress}`);
        }
      }
    } else if (refundType === 'subscription') {
      // For subscription refunds, revoke the subscription
      const { error: deleteError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('creator_id', creatorId)
        .eq('wallet_address', userWalletAddress.toLowerCase());

      if (deleteError) {
        console.error('Error revoking subscription:', deleteError);
      } else {
        console.log(`✅ Revoked subscription for creator ${creatorId} and wallet ${userWalletAddress}`);
      }
    } else if (refundType === 'recurringTip') {
      // For recurring tip refunds, revoke the recurring tip
      const { error: deleteError } = await supabase
        .from('recurring_tips')
        .delete()
        .eq('creator_id', creatorId)
        .eq('wallet_address', userWalletAddress.toLowerCase());

      if (deleteError) {
        console.error('Error revoking recurring tip:', deleteError);
      } else {
        console.log(`✅ Revoked recurring tip for creator ${creatorId} and wallet ${userWalletAddress}`);
      }
    }
    // Note: One-time tips don't grant access, so no revocation needed

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

    if (creatorId && userWalletAddress) {
      // Get user's refunds for a specific creator
      const { data: refunds, error } = await supabase
        .from('refunds')
        .select('*')
        .eq('creator_id', creatorId)
        .eq('user_wallet_address', userWalletAddress.toLowerCase())
        .order('created_at', { ascending: false });

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

