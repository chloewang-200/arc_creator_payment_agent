import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { synthesizePreview } from '@/lib/elevenlabs';

// Default voice IDs from ElevenLabs library
const DEFAULT_VOICES = {
  male: 'pNInz6obpgDQGcFmaJgB', // Adam - deep, clear male voice
  female: 'EXAVITQu4vr4xnSDxMaL', // Bella - warm, friendly female voice
  neutral: '21m00Tcm4TlvDq8ikWAM', // Rachel - neutral, professional
};

// GET /api/posts/[id]/audio - Generate audio for post text
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const walletAddress = request.nextUrl.searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress required' },
        { status: 400 }
      );
    }

    // Get post data
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        intro,
        content,
        price_usd,
        creator_id,
        creators (
          id,
          name,
          username,
          elevenlabs_voice_id,
          voice_preview_enabled
        )
      `)
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the post
    if (post.price_usd > 0) {
      const { data: unlock } = await supabase
        .from('post_unlocks')
        .select('id')
        .eq('post_id', postId)
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('creator_id', post.creator_id)
        .eq('wallet_address', walletAddress.toLowerCase())
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!unlock && !subscription) {
        return NextResponse.json(
          { error: 'You must unlock this post to listen to it' },
          { status: 403 }
        );
      }
    }

    // Get full text (intro + content)
    const fullText = `${post.intro}\n\n${post.content}`;

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: 'Post has no text content' },
        { status: 400 }
      );
    }

    // Limit to ~5 seconds of speech (roughly 12-15 words)
    // This is due to free tier ElevenLabs limitations
    const MAX_WORDS = 15;
    const words = fullText.trim().split(/\s+/);
    const limitedWords = words.slice(0, MAX_WORDS);
    const limitedText = limitedWords.join(' ') + (words.length > MAX_WORDS ? '...' : '');

    console.log(`[audio] Limited text from ${words.length} to ${limitedWords.length} words for 5-second cap`);

    // Determine which voice to use
    let voiceId: string;
    const creator = Array.isArray(post.creators) ? post.creators[0] : post.creators;

    if (creator?.elevenlabs_voice_id && creator?.voice_preview_enabled) {
      // Use creator's voice
      voiceId = creator.elevenlabs_voice_id;
      console.log(`[audio] Using creator voice: ${voiceId}`);
    } else {
      // Use default voice (neutral professional voice)
      voiceId = DEFAULT_VOICES.neutral;
      console.log(`[audio] Using default voice: ${voiceId}`);
    }

    // Generate audio using ElevenLabs
    console.log(`[audio] Generating audio for post ${postId}`);
    const audioBuffer = await synthesizePreview({
      voiceId,
      text: limitedText,
      outputFormat: 'mp3_44100_128',
    });

    // Return audio as response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: any) {
    console.error('Error generating audio:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate audio',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
