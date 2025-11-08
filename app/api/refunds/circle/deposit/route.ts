import { NextRequest, NextResponse } from 'next/server';
import { creditCreatorBalance, getCreatorCircleWallet } from '@/lib/circle-refund-wallet';
import { supabaseAdmin } from '@/lib/supabase-admin';

// POST /api/refunds/circle/deposit
// Record a USDC deposit from creator to their Circle wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, amountUSD, transactionHash, chainId } = body;

    if (!creatorId || !amountUSD || !transactionHash) {
      return NextResponse.json(
        { error: 'creatorId, amountUSD, and transactionHash are required' },
        { status: 400 }
      );
    }

    // Check if deposit already recorded (prevent double-counting)
    const { data: existing } = await supabaseAdmin
      .from('refund_deposits')
      .select('id')
      .eq('transaction_hash', transactionHash)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Deposit already recorded' },
        { status: 400 }
      );
    }

    // Ensure creator has a Circle wallet
    const wallet = await getCreatorCircleWallet(creatorId);
    if (!wallet) {
      return NextResponse.json(
        { error: 'Circle refund wallet not initialized for this creator' },
        { status: 400 }
      );
    }

    // Credit creator's balance
    const result = await creditCreatorBalance(creatorId, amountUSD);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Record deposit in database
    const { ARC_CHAIN_ID } = await import('@/lib/config');
    const { error: insertError } = await supabaseAdmin
      .from('refund_deposits')
      .insert({
        creator_id: creatorId,
        amount_usd: amountUSD,
        transaction_hash: transactionHash,
        chain_id: chainId || ARC_CHAIN_ID,
        status: 'confirmed',
      });

    if (insertError) {
      console.error('Error recording deposit:', insertError);
      // Balance already credited, so we'll continue
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      message: `Deposited $${amountUSD.toFixed(2)} successfully`,
    });
  } catch (error: any) {
    console.error('Error processing deposit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process deposit' },
      { status: 500 }
    );
  }
}
