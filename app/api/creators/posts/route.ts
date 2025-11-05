import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/creators/posts?creatorId=... or ?wallet=0x...
export async function GET(request: NextRequest) {
  const creatorId = request.nextUrl.searchParams.get('creatorId');
  const wallet = request.nextUrl.searchParams.get('wallet');

  if (!creatorId && !wallet) {
    return NextResponse.json(
      { error: 'creatorId or wallet parameter required' },
      { status: 400 }
    );
  }

  try {
    let query = supabase.from('posts').select('*').eq('published', true);

    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    } else if (wallet) {
      // First get creator by wallet
      const { data: creator } = await supabase
        .from('creators')
        .select('id')
        .eq('wallet_address', wallet)
        .single();

      if (!creator) {
        return NextResponse.json({ posts: [] });
      }

      query = query.eq('creator_id', creator.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to frontend format
    const posts = (data || []).map((post) => ({
      id: post.id,
      creatorId: post.creator_id,
      title: post.title,
      intro: post.intro,
      body: post.body,
      priceUSD: post.price_usd,
      contentType: post.content_type,
      includedInSubscription: true,
      createdAt: post.created_at,
    }));

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST /api/creators/posts - Create new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, title, intro, body: postBody, priceUSD, contentType } = body;

    if (!creatorId || !title || !intro || !postBody || priceUSD === undefined) {
      return NextResponse.json(
        { error: 'creatorId, title, intro, body, and priceUSD are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        creator_id: creatorId,
        title,
        intro,
        body: postBody,
        price_usd: priceUSD,
        content_type: contentType || 'post',
        published: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      post: {
        id: data.id,
        creatorId: data.creator_id,
        title: data.title,
        intro: data.intro,
        body: data.body,
        priceUSD: data.price_usd,
        contentType: data.content_type,
        createdAt: data.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create post' },
      { status: 500 }
    );
  }
}
