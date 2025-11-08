import { NextRequest, NextResponse } from 'next/server';
import {
  canProcessRefund,
  processRefundViaCircle,
} from '@/lib/circle-refund-wallet';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/refunds/circle/process
// Process an automated refund via Circle wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refundId, creatorId, userAddress, amountUSD } = body;

    if (!refundId || !creatorId || !userAddress || !amountUSD) {
      return NextResponse.json(
        { error: 'refundId, creatorId, userAddress, and amountUSD are required' },
        { status: 400 }
      );
    }

    console.log(`[Refund] Processing automated refund: ${refundId}`);

    // Check if refund can be processed
    const eligibility = await canProcessRefund(creatorId, amountUSD);
    if (!eligibility.canProcess) {
      return NextResponse.json(
        { error: eligibility.reason },
        { status: 400 }
      );
    }

    // Get refund details
    const { data: refund, error: refundError } = await supabaseAdmin
      .from('refunds')
      .select('*')
      .eq('id', refundId)
      .single();

    if (refundError || !refund) {
      return NextResponse.json(
        { error: 'Refund not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (refund.status === 'approved' || refund.status === 'completed') {
      return NextResponse.json(
        { error: 'Refund already processed' },
        { status: 400 }
      );
    }

    // Update refund status to processing
    await supabaseAdmin
      .from('refunds')
      .update({
        status: 'processing',
      })
      .eq('id', refundId);

    // Process refund via Circle
    const { ARC_CHAIN_ID } = await import('@/lib/config');
    const result = await processRefundViaCircle({
      creatorId,
      userAddress,
      amountUSD,
      chainId: refund.chain_id || ARC_CHAIN_ID,
    });

    if (!result.success) {
      // Update refund status to failed
      await supabaseAdmin
        .from('refunds')
        .update({
          status: 'rejected',
          rejection_reason: result.error || 'Circle transaction failed',
        })
        .eq('id', refundId);

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // NOTE: Balance is tracked on-chain, not in database
    // The Circle wallet balance will automatically decrease after sending USDC

    // Update refund status to completed
    const updateData: any = {
      status: 'completed',
      refund_transaction_hash: result.transactionHash || null,
      processed_at: new Date().toISOString(),
    };
    
    // Store Circle transaction ID (challengeId) if available
    if (result.challengeId) {
      updateData.circle_transaction_id = result.challengeId;
    }
    
    await supabaseAdmin
      .from('refunds')
      .update(updateData)
      .eq('id', refundId);

    // Update daily refund totals
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyTotal } = await supabaseAdmin
      .from('daily_refund_totals')
      .select('total_refunded_usd')
      .eq('creator_id', creatorId)
      .eq('date', today)
      .maybeSingle();

    const newTotal = (dailyTotal?.total_refunded_usd || 0) + amountUSD;

    await supabaseAdmin
      .from('daily_refund_totals')
      .upsert({
        creator_id: creatorId,
        date: today,
        total_refunded_usd: newTotal,
      });

    console.log(`[Refund] Completed: ${refundId} - ${result.transactionHash}`);

    return NextResponse.json({
      success: true,
      transactionHash: result.transactionHash,
      challengeId: result.challengeId,
      message: `Refund of $${amountUSD.toFixed(2)} processed successfully`,
    });
  } catch (error: any) {
    console.error('[Refund] Error processing automated refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund' },
      { status: 500 }
    );
  }
}
