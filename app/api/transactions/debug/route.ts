import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creatorId = searchParams.get('creatorId');
    const walletAddress = searchParams.get('walletAddress');

    const debug: any = {};

    // 1. Check creator exists
    if (creatorId) {
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('*')
        .eq('id', creatorId)
        .single();
      
      debug.creator = { 
        found: !!creator, 
        data: creator,
        error: creatorError?.message 
      };
    }

    // 2. Check posts for this creator
    if (creatorId) {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, title, creator_id')
        .eq('creator_id', creatorId);
      
      debug.posts = {
        count: posts?.length || 0,
        data: posts,
        error: postsError?.message
      };
    }

    // 3. Check ALL post_unlocks (no filter)
    const { data: allUnlocks, error: allUnlocksError } = await supabase
      .from('post_unlocks')
      .select('*')
      .order('unlocked_at', { ascending: false })
      .limit(10);
    
    debug.allUnlocks = {
      count: allUnlocks?.length || 0,
      recent: allUnlocks,
      error: allUnlocksError?.message
    };

    // 4. Check unlocks for creator's posts
    if (creatorId) {
      const { data: creatorPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('creator_id', creatorId);
      
      if (creatorPosts && creatorPosts.length > 0) {
        const postIds = creatorPosts.map(p => p.id);
        const { data: creatorUnlocks, error: creatorUnlocksError } = await supabase
          .from('post_unlocks')
          .select('*, posts(id, title, creator_id)')
          .in('post_id', postIds);
        
        debug.creatorUnlocks = {
          count: creatorUnlocks?.length || 0,
          data: creatorUnlocks,
          error: creatorUnlocksError?.message
        };
      } else {
        debug.creatorUnlocks = {
          count: 0,
          message: 'No posts found for creator, so no unlocks possible'
        };
      }
    }

    // 5. Check unlocks by wallet address
    if (walletAddress) {
      const { data: walletUnlocks, error: walletUnlocksError } = await supabase
        .from('post_unlocks')
        .select('*, posts(id, title, creator_id)')
        .eq('wallet_address', walletAddress.toLowerCase())
        .order('unlocked_at', { ascending: false });
      
      debug.walletUnlocks = {
        count: walletUnlocks?.length || 0,
        data: walletUnlocks,
        error: walletUnlocksError?.message
      };
    }

    return NextResponse.json({ debug });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}

