import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/purchases - Get user's purchase history (refundable items)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userWalletAddress = searchParams.get('userWalletAddress');
    const creatorId = searchParams.get('creatorId');

    if (!userWalletAddress || !creatorId) {
      return NextResponse.json(
        { error: 'userWalletAddress and creatorId are required' },
        { status: 400 }
      );
    }

    const purchases: any[] = [];

    // Get unlocked posts - get price from posts table, not post_unlocks
    const { data: unlocks, error: unlocksError } = await supabase
      .from('post_unlocks')
      .select('id, post_id, transaction_hash, created_at, chain_id, posts!inner(title, creator_id, price_usd)')
      .eq('wallet_address', userWalletAddress.toLowerCase())
      .eq('posts.creator_id', creatorId)
      .order('created_at', { ascending: false });

    console.log('[Purchases API] Unlocks query:', { userWalletAddress, creatorId, unlocks, error: unlocksError });

    if (!unlocksError && unlocks) {
      for (const unlock of unlocks) {
        // posts is an array from Supabase join, get first element
        const post = Array.isArray(unlock.posts) ? unlock.posts[0] : unlock.posts;
        if (post) {
          purchases.push({
            type: 'unlock',
            id: unlock.id,
            postId: unlock.post_id,
            postTitle: post.title,
            amountUSD: post.price_usd, // Get price from posts table
            transactionId: unlock.id, // Use the post_unlock.id as transactionId
            transactionHash: unlock.transaction_hash,
            createdAt: unlock.created_at,
            chainId: unlock.chain_id,
          });
        }
      }
    } else if (unlocksError) {
      console.error('[Purchases API] Error fetching unlocks:', unlocksError);
    }

    // Get active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('id, creator_id, amount_usd, transaction_hash, active_until, created_at')
      .eq('wallet_address', userWalletAddress.toLowerCase())
      .eq('creator_id', creatorId)
      .gte('active_until', new Date().toISOString())
      .maybeSingle();

    console.log('[Purchases API] Subscription query:', { subscription, error: subError });

    if (!subError && subscription) {
      purchases.push({
        type: 'subscription',
        id: subscription.id,
        amountUSD: subscription.amount_usd,
        transactionId: subscription.id, // Use subscription.id as transactionId
        transactionHash: subscription.transaction_hash,
        activeUntil: subscription.active_until,
        createdAt: subscription.created_at,
      });
    } else if (subError) {
      console.error('[Purchases API] Error fetching subscription:', subError);
    }

    console.log('[Purchases API] Final result:', { count: purchases.length, purchases });

    return NextResponse.json({
      purchases,
      count: purchases.length,
    });
  } catch (error: any) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch purchases' },
      { status: 500 }
    );
  }
}
