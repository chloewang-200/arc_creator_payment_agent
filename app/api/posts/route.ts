import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/posts?creatorId=uuid or ?creatorEmail=email
export async function GET(request: NextRequest) {
  const creatorId = request.nextUrl.searchParams.get('creatorId');
  const creatorEmail = request.nextUrl.searchParams.get('creatorEmail');

  if (!creatorId && !creatorEmail) {
    return NextResponse.json(
      { error: 'creatorId or creatorEmail parameter required' },
      { status: 400 }
    );
  }

  try {
    let finalCreatorId = creatorId;

    // If email provided, get creator ID first
    if (creatorEmail && !creatorId) {
      const { data: creator } = await supabase
        .from('creators')
        .select('id')
        .eq('email', creatorEmail)
        .single();

      if (!creator) {
        return NextResponse.json({ posts: [] });
      }
      finalCreatorId = creator.id;
    }

    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('creator_id', finalCreatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to frontend format
    const transformedPosts = (posts || []).map((post) => ({
      id: post.id,
      creatorId: post.creator_id,
      title: post.title,
      intro: post.intro,
      body: post.content,
      priceUSD: post.price_usd,
      contentType: post.content_type || 'post',
      includedInSubscription: post.included_in_subscription,
      createdAt: post.created_at,
      voicePreviewUrl: post.voice_preview_url,
      voicePreviewDurationSeconds: post.voice_preview_duration_seconds,
      voicePreviewStatus: post.voice_preview_status,
      voicePreviewText: post.voice_preview_text,
      voicePreviewGeneratedAt: post.voice_preview_generated_at,
    }));

    return NextResponse.json({ posts: transformedPosts });
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      creatorEmail,
      title,
      intro,
      content,
      priceUSD,
      contentType,
      includedInSubscription,
      voicePreviewUrl,
      voicePreviewDurationSeconds,
      voicePreviewStatus,
      voicePreviewText,
      voicePreviewGeneratedAt,
    } = body;

    if (!creatorEmail || !title || !intro || !content) {
      return NextResponse.json(
        { error: 'creatorEmail, title, intro, and content are required' },
        { status: 400 }
      );
    }

    // Get creator ID from email
    const { data: creator } = await supabase
      .from('creators')
      .select('id')
      .eq('email', creatorEmail)
      .single();

    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    // Insert post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        creator_id: creator.id,
        title,
        intro,
        content,
        price_usd: priceUSD || 0.69,
        content_type: contentType || 'post',
        included_in_subscription: includedInSubscription !== false,
        voice_preview_url: voicePreviewUrl,
        voice_preview_duration_seconds: voicePreviewDurationSeconds,
        voice_preview_status: voicePreviewStatus,
        voice_preview_text: voicePreviewText,
        voice_preview_generated_at: voicePreviewGeneratedAt,
      })
      .select()
      .single();

    if (postError) throw postError;

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        creatorId: post.creator_id,
        title: post.title,
        intro: post.intro,
        body: post.content,
        priceUSD: post.price_usd,
        contentType: post.content_type,
        includedInSubscription: post.included_in_subscription,
        createdAt: post.created_at,
        voicePreviewUrl: post.voice_preview_url,
        voicePreviewDurationSeconds: post.voice_preview_duration_seconds,
        voicePreviewStatus: post.voice_preview_status,
        voicePreviewText: post.voice_preview_text,
        voicePreviewGeneratedAt: post.voice_preview_generated_at,
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

// PUT /api/posts - Update post
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      postId,
      title,
      intro,
      content,
      priceUSD,
      contentType,
      includedInSubscription,
      voicePreviewUrl,
      voicePreviewDurationSeconds,
      voicePreviewStatus,
      voicePreviewText,
      voicePreviewGeneratedAt,
    } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'postId is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (intro !== undefined) updateData.intro = intro;
    if (content !== undefined) updateData.content = content;
    if (priceUSD !== undefined) updateData.price_usd = priceUSD;
    if (contentType !== undefined) updateData.content_type = contentType;
    if (includedInSubscription !== undefined) updateData.included_in_subscription = includedInSubscription;
    if (voicePreviewUrl !== undefined) updateData.voice_preview_url = voicePreviewUrl;
    if (voicePreviewDurationSeconds !== undefined) updateData.voice_preview_duration_seconds = voicePreviewDurationSeconds;
    if (voicePreviewStatus !== undefined) updateData.voice_preview_status = voicePreviewStatus;
    if (voicePreviewText !== undefined) updateData.voice_preview_text = voicePreviewText;
    if (voicePreviewGeneratedAt !== undefined) updateData.voice_preview_generated_at = voicePreviewGeneratedAt;

    const { data: post, error: postError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId)
      .select()
      .single();

    if (postError) throw postError;

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        creatorId: post.creator_id,
        title: post.title,
        intro: post.intro,
        body: post.content,
        priceUSD: post.price_usd,
        contentType: post.content_type,
        includedInSubscription: post.included_in_subscription,
        createdAt: post.created_at,
        voicePreviewUrl: post.voice_preview_url,
        voicePreviewDurationSeconds: post.voice_preview_duration_seconds,
        voicePreviewStatus: post.voice_preview_status,
        voicePreviewText: post.voice_preview_text,
        voicePreviewGeneratedAt: post.voice_preview_generated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update post' },
      { status: 500 }
    );
  }
}
