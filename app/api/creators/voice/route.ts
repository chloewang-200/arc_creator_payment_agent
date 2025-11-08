import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createOrUpdateVoice } from '@/lib/elevenlabs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VOICE_BUCKET = process.env.SUPABASE_VOICE_BUCKET || 'creator-voices';
// Allow re-uploading voices (set to 'true' for demo/testing, 'false' for production with ElevenLabs free tier)
const ALLOW_VOICE_REUPLOAD = process.env.ALLOW_VOICE_REUPLOAD === 'true';

export async function POST(request: NextRequest) {
  try {
    console.log('[voice-upload] Incoming request');
    const formData = await request.formData();
    const creatorId = formData.get('creatorId')?.toString();
    const voiceSample = formData.get('voiceSample');
    const durationValue = formData.get('durationSeconds');
    const durationSeconds = durationValue ? Number(durationValue) : null;

    if (!creatorId) {
      return NextResponse.json({ error: 'creatorId is required' }, { status: 400 });
    }

    if (!(voiceSample instanceof File)) {
      return NextResponse.json({ error: 'voiceSample file is required' }, { status: 400 });
    }

    const fileSizeMb = voiceSample.size / (1024 * 1024);
    if (fileSizeMb > 10) {
      return NextResponse.json({ error: 'Voice sample must be smaller than 10MB' }, { status: 400 });
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from('creators')
      .select('id, name, username, elevenlabs_voice_id')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Check if re-upload is allowed via environment variable
    // If ALLOW_VOICE_REUPLOAD is false (default), only allow one upload per creator
    // This is due to ElevenLabs free tier limitations
    if (!ALLOW_VOICE_REUPLOAD && creator.elevenlabs_voice_id) {
      console.log('[voice-upload] Voice already exists, rejecting upload', { creatorId: creator.id, allowReupload: ALLOW_VOICE_REUPLOAD });
      return NextResponse.json(
        {
          error: 'Voice already uploaded',
          message: 'Demo limitation: Only one voice upload allowed per creator due to ElevenLabs free tier. Set ALLOW_VOICE_REUPLOAD=true to allow re-uploads, or contact support to update your voice.',
        },
        { status: 403 }
      );
    }

    console.log('[voice-upload] Creator found', { creatorId: creator.id, existingVoiceId: creator.elevenlabs_voice_id });
    const audioBuffer = await voiceSample.arrayBuffer();

    const filePath = `${creatorId}/samples/${Date.now()}-${voiceSample.name || 'voice-sample.mp3'}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .upload(filePath, voiceSample, {
        cacheControl: '3600',
        contentType: voiceSample.type || 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload voice sample:', uploadError);
      return NextResponse.json({ error: 'Failed to upload voice sample' }, { status: 500 });
    }
    console.log('[voice-upload] Uploaded to storage', { bucket: VOICE_BUCKET, filePath });

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(VOICE_BUCKET)
      .getPublicUrl(filePath);
    const sampleUrl = publicUrlData.publicUrl;

    const voiceName = `${creator.name || creator.username || 'Bloby on Arc'} Voice`;
    console.log('[voice-upload] Calling ElevenLabs');
    const { voiceId } = await createOrUpdateVoice({
      audioBuffer,
      fileName: voiceSample.name || 'voice-sample.mp3',
      mimeType: voiceSample.type || 'audio/mpeg',
      voiceName,
      existingVoiceId: creator.elevenlabs_voice_id,
      description: `Bloby on Arc creator voice for ${creator.username || creatorId}`,
    });
    console.log('[voice-upload] ElevenLabs response', { voiceId });

    await supabaseAdmin
      .from('creators')
      .update({
        voice_sample_url: sampleUrl,
        voice_sample_duration_seconds: durationSeconds,
        voice_preview_enabled: true,
        voice_clone_status: 'ready',
        elevenlabs_voice_id: voiceId,
      })
      .eq('id', creatorId);

    return NextResponse.json({
      success: true,
      voiceSampleUrl: sampleUrl,
      elevenLabsVoiceId: voiceId,
      durationSeconds,
    });
  } catch (error: unknown) {
    console.error('Error uploading voice sample:', error);
    return NextResponse.json(
      {
        error: 'Failed to process voice sample',
        details: (error as Error)?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
