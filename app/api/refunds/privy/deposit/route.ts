import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { creditCreatorBalance, getPlatformRefundWallet } from '@/lib/privy-refund-wallet';

// POST /api/refunds/privy/deposit - Record a deposit to creator's refund balance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, amountUSD, transactionHash, chainId } = body;

    if (!creatorId || !amountUSD) {
      return NextResponse.json(
        { error: 'creatorId and amountUSD required' },
        { status: 400 }
      );
    }

    if (amountUSD <= 0) {
      return NextResponse.json(
        { error: 'Amount must be positive' },
        { status: 400 }
      );
    }

    // Get platform wallet
    const platformWallet = await getPlatformRefundWallet();
    if (!platformWallet) {
      return NextResponse.json(
        { error: 'Platform refund wallet not initialized' },
        { status: 500 }
      );
    }

    // Record deposit
    const { data: deposit, error: depositError } = await supabase
      .from('refund_deposits')
      .insert({
        creator_id: creatorId,
        amount_usd: amountUSD,
        transaction_hash: transactionHash,
        chain_id: chainId,
        status: transactionHash ? 'completed' : 'pending',
        processed_at: transactionHash ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (depositError) throw depositError;

    // Credit creator balance if transaction confirmed
    if (transactionHash) {
      const creditResult = await creditCreatorBalance(creatorId, amountUSD);
      if (!creditResult.success) {
        return NextResponse.json(
          { error: 'Failed to credit balance', details: creditResult.error },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deposit: {
          id: deposit.id,
          amount: amountUSD,
          newBalance: creditResult.newBalance,
        },
        message: `Successfully deposited $${amountUSD.toFixed(2)} USDC`,
      });
    }

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount: amountUSD,
        status: 'pending',
      },
      message: 'Deposit recorded, awaiting confirmation',
    });
  } catch (error: any) {
    console.error('Error processing deposit:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process deposit' },
      { status: 500 }
    );
  }
}

// GET /api/refunds/privy/deposit - Get deposit history
export async function GET(request: NextRequest) {
  try {
    const creatorId = request.nextUrl.searchParams.get('creatorId');

    if (!creatorId) {
      return NextResponse.json(
        { error: 'creatorId required' },
        { status: 400 }
      );
    }

    const { data: deposits, error } = await supabase
      .from('refund_deposits')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ deposits });
  } catch (error: any) {
    console.error('Error fetching deposits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deposits' },
      { status: 500 }
    );
  }
}
