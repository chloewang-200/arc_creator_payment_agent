import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  canProcessRefund,
  debitCreatorBalance,
  processRefundViaPrivy,
} from '@/lib/privy-refund-wallet';

// POST /api/refunds/privy/process - Process automated refund via Privy wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creatorId,
      userWalletAddress,
      transactionId,
      refundType,
      amountUSD,
      chainId = 84532,
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
          reason: 'Tips are voluntary contributions and are non-refundable.',
        },
        { status: 403 }
      );
    }

    // Check if refund can be processed
    const eligibility = await canProcessRefund(creatorId, amountUSD);
    if (!eligibility.canProcess) {
      return NextResponse.json(
        {
          error: 'Refund cannot be processed',
          reason: eligibility.reason,
          requiresManualApproval: true,
        },
        { status: 400 }
      );
    }

    // Calculate refund amount (minus fee)
    const feePercentage = 0.02; // 2% platform fee
    const feeAmount = amountUSD * feePercentage;
    const refundAmount = amountUSD - feeAmount;

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
        status: 'processing',
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

    // Process refund via Privy
    const result = await processRefundViaPrivy({
      userAddress: userWalletAddress,
      amountUSD: refundAmount,
      chainId,
    });

    if (result.success && result.transactionHash) {
      // Debit creator balance
      const debitResult = await debitCreatorBalance(creatorId, amountUSD);
      if (!debitResult.success) {
        // Refund succeeded but balance debit failed - log error but don't fail request
        console.error('Failed to debit creator balance:', debitResult.error);
      }

      // Update refund record
      await supabase
        .from('refunds')
        .update({
          refund_transaction_hash: result.transactionHash,
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', refund.id);

      // Revoke access
      await revokeAccess(refundType, transactionId, creatorId, userWalletAddress);

      return NextResponse.json({
        success: true,
        refund: {
          id: refund.id,
          refundAmount,
          feeAmount,
          originalAmount: amountUSD,
          status: 'completed',
          refundType,
          transactionHash: result.transactionHash,
          chainId,
          newBalance: debitResult.newBalance,
          message: 'Refund processed successfully via platform wallet',
          automated: true,
        },
      });
    } else {
      // Refund failed
      await supabase
        .from('refunds')
        .update({
          status: 'failed',
          reason: result.error,
        })
        .eq('id', refund.id);

      return NextResponse.json(
        {
          error: 'Failed to process refund',
          details: result.error,
          refundId: refund.id,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error processing Privy refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}

// Helper function to revoke access
async function revokeAccess(
  refundType: string,
  transactionId: string,
  creatorId: string,
  userWalletAddress: string
) {
  try {
    if (refundType === 'unlock') {
      const { data: postUnlock } = await supabase
        .from('post_unlocks')
        .select('post_id, id')
        .or(`id.eq.${transactionId},transaction_hash.eq.${transactionId}`)
        .eq('wallet_address', userWalletAddress.toLowerCase())
        .maybeSingle();

      if (postUnlock) {
        await supabase
          .from('post_unlocks')
          .delete()
          .eq('id', postUnlock.id)
          .eq('wallet_address', userWalletAddress.toLowerCase());
      } else {
        await supabase
          .from('post_unlocks')
          .delete()
          .eq('post_id', transactionId)
          .eq('wallet_address', userWalletAddress.toLowerCase());
      }
    } else if (refundType === 'subscription') {
      await supabase
        .from('subscriptions')
        .delete()
        .eq('creator_id', creatorId)
        .eq('wallet_address', userWalletAddress.toLowerCase());
    }
  } catch (error) {
    console.error('Error revoking access:', error);
  }
}
