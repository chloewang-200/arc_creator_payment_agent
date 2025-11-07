import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { preparePreviewText, synthesizePreview } from '@/lib/elevenlabs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PREVIEW_BUCKET = process.env.SUPABASE_POST_AUDIO_BUCKET || 'post-voice-previews';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { postId } = body;

  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 });
  }

  try {
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, creator_id, title, intro, content, voice_preview_status')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('id, name, username, voice_preview_enabled, elevenlabs_voice_id')
      .eq('id', post.creator_id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    if (!creator.voice_preview_enabled) {
      return NextResponse.json({ error: 'Voice previews are disabled for this creator' }, { status: 400 });
    }

    if (!creator.elevenlabs_voice_id) {
      return NextResponse.json({ error: 'Creator voice is not configured yet' }, { status: 400 });
    }

    const textSource = [post.content, post.intro].filter(Boolean).join(' ');
    const { previewText, estimatedDurationSeconds } = preparePreviewText(textSource, 10);

    if (!previewText) {
      return NextResponse.json({ error: 'Post does not have enough content to narrate' }, { status: 400 });
    }

    await supabaseAdmin
      .from('posts')
      .update({ voice_preview_status: 'pending' })
      .eq('id', postId);

    const audioBuffer = await synthesizePreview({
      voiceId: creator.elevenlabs_voice_id,
      text: previewText,
    });

    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const filePath = `${post.creator_id}/${post.id}/preview-${Date.now()}.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .upload(filePath, audioBlob, {
        cacheControl: '3600',
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload preview audio:', uploadError);
      await supabaseAdmin
        .from('posts')
        .update({ voice_preview_status: 'failed' })
        .eq('id', postId);
      return NextResponse.json({ error: 'Failed to upload preview audio' }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(PREVIEW_BUCKET)
      .getPublicUrl(filePath);
    const previewUrl = publicUrlData.publicUrl;

    await supabaseAdmin
      .from('posts')
      .update({
        voice_preview_url: previewUrl,
        voice_preview_duration_seconds: Math.min(10, Math.round(estimatedDurationSeconds)),
        voice_preview_status: 'ready',
        voice_preview_text: previewText,
        voice_preview_generated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    return NextResponse.json({
      success: true,
      previewUrl,
      durationSeconds: Math.min(10, Math.round(estimatedDurationSeconds)),
    });
  } catch (error: unknown) {
    console.error('Error generating post voice preview:', error);
    await supabaseAdmin
      .from('posts')
      .update({ voice_preview_status: 'failed' })
      .eq('id', postId);
    return NextResponse.json(
      {
        error: 'Failed to generate preview audio',
        details: (error as Error)?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
