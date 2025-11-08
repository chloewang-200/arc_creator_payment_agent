import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { synthesizePreview } from '@/lib/elevenlabs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const AUDIO_BUCKET = process.env.SUPABASE_POST_AUDIO_BUCKET || 'post-voice-previews';

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

    // Get post data (including cached audio URL)
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        intro,
        content,
        price_usd,
        creator_id,
        listen_audio_url,
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

    // Check if cached audio exists
    if (post.listen_audio_url) {
      console.log(`[audio] Found cached audio for post ${postId}: ${post.listen_audio_url}`);
      try {
        // Fetch the cached audio from storage
        const audioResponse = await fetch(post.listen_audio_url);
        if (audioResponse.ok) {
          const audioBuffer = await audioResponse.arrayBuffer();
          console.log(`[audio] Returning cached audio for post ${postId}`);
          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Length': audioBuffer.byteLength.toString(),
              'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
          });
        } else {
          console.log(`[audio] Cached audio not found, will regenerate: ${post.listen_audio_url}`);
        }
      } catch (error) {
        console.warn(`[audio] Error fetching cached audio, will regenerate:`, error);
      }
    }

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

    // Store audio in Supabase Storage for future use
    try {
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const filePath = `${post.creator_id}/${postId}/listen-${Date.now()}.mp3`;

      const { error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(filePath, audioBlob, {
          cacheControl: '86400',
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from(AUDIO_BUCKET)
          .getPublicUrl(filePath);
        const audioUrl = publicUrlData.publicUrl;

        // Update post with cached audio URL
        await supabase
          .from('posts')
          .update({ listen_audio_url: audioUrl })
          .eq('id', postId);

        console.log(`[audio] Stored audio in cache: ${audioUrl}`);
      } else {
        console.warn(`[audio] Failed to store audio in cache:`, uploadError);
      }
    } catch (storageError) {
      console.warn(`[audio] Error storing audio in cache:`, storageError);
      // Continue even if storage fails - still return the audio
    }

    // Return audio as response
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
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
