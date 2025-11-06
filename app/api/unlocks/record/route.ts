import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postId, walletAddress, txHash, type, chainId } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Handle different payment types
    if (type === 'unlock' && postId) {
      // Record post unlock
      const { error } = await supabase
        .from('post_unlocks')
        .upsert({
          post_id: postId,
          wallet_address: walletAddress.toLowerCase(),
          transaction_hash: txHash,
          chain_id: chainId,
          unlocked_at: new Date().toISOString(),
        }, {
          onConflict: 'post_id,wallet_address'
        });

      if (error) {
        console.error('Error recording post unlock:', error);
        return NextResponse.json({ 
          error: 'Failed to record unlock',
          details: error.message,
          code: error.code 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (type === 'subscription') {
      const { creatorId, days = 30 } = body;

      if (!creatorId) {
        return NextResponse.json({ error: 'Creator ID required' }, { status: 400 });
      }

      const activeUntil = new Date();
      activeUntil.setDate(activeUntil.getDate() + days);

      const { error } = await supabase
        .from('subscriptions')
        .upsert({
          creator_id: creatorId,
          wallet_address: walletAddress.toLowerCase(),
          active_until: activeUntil.toISOString(),
          transaction_hash: txHash,
          chain_id: chainId,
        }, {
          onConflict: 'creator_id,wallet_address'
        });

      if (error) {
        console.error('Error recording subscription:', error);
        return NextResponse.json({ 
          error: 'Failed to record subscription',
          details: error.message,
          code: error.code 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (type === 'recurringTip') {
      const { creatorId, amount, days = 30 } = body;

      if (!creatorId || !amount) {
        return NextResponse.json({ error: 'Creator ID and amount required' }, { status: 400 });
      }

      const activeUntil = new Date();
      activeUntil.setDate(activeUntil.getDate() + days);

      const { error } = await supabase
        .from('recurring_tips')
        .upsert({
          creator_id: creatorId,
          wallet_address: walletAddress.toLowerCase(),
          amount_usd: amount,
          active_until: activeUntil.toISOString(),
          transaction_hash: txHash,
          chain_id: chainId,
        }, {
          onConflict: 'creator_id,wallet_address'
        });

      if (error) {
        console.error('Error recording recurring tip:', error);
        return NextResponse.json({ 
          error: 'Failed to record recurring tip',
          details: error.message,
          code: error.code 
        }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in unlock record API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}
