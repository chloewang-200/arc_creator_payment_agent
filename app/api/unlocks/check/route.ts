import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const postId = searchParams.get('postId');
    const walletAddress = searchParams.get('walletAddress');

    if (!postId || !walletAddress) {
      return NextResponse.json({ error: 'Post ID and wallet address required' }, { status: 400 });
    }

    // Get the post to find its creator
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('creator_id, price_usd')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if post is free
    if (post.price_usd === 0) {
      return NextResponse.json({ hasAccess: true, reason: 'free' });
    }

    const normalizedWallet = walletAddress.toLowerCase();

    // Check if directly unlocked
    const { data: unlock } = await supabase
      .from('post_unlocks')
      .select('id')
      .eq('post_id', postId)
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (unlock) {
      return NextResponse.json({ hasAccess: true, reason: 'unlocked' });
    }

    // Check if has active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('active_until')
      .eq('creator_id', post.creator_id)
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (subscription && new Date(subscription.active_until) > new Date()) {
      return NextResponse.json({ hasAccess: true, reason: 'subscription' });
    }

    // Check if has active recurring tip
    const { data: recurringTip } = await supabase
      .from('recurring_tips')
      .select('active_until')
      .eq('creator_id', post.creator_id)
      .eq('wallet_address', normalizedWallet)
      .maybeSingle();

    if (recurringTip && new Date(recurringTip.active_until) > new Date()) {
      return NextResponse.json({ hasAccess: true, reason: 'recurringTip' });
    }

    return NextResponse.json({ hasAccess: false, reason: 'locked' });
  } catch (error) {
    console.error('Error checking unlock status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
