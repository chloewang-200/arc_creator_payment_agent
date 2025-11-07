const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2';

const DEFAULT_AUDIO_MIME = 'audio/mpeg';

type VoiceCloneResult = {
  voiceId: string;
  rawResponse?: ElevenLabsVoiceResponse | null;
};

type ElevenLabsVoiceResponse = {
  voice_id?: string;
  [key: string]: unknown;
};

type PreviewTextResult = {
  previewText: string;
  estimatedDurationSeconds: number;
};

const APPROX_WORDS_PER_SECOND = 2.4;

function ensureApiKey() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }
}

export function preparePreviewText(fullText: string, maxSeconds = 10): PreviewTextResult {
  const sanitized = (fullText || '')
    .replace(/\s+/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();

  if (!sanitized) {
    return { previewText: '', estimatedDurationSeconds: 0 };
  }

  const maxWords = Math.max(10, Math.floor(maxSeconds * APPROX_WORDS_PER_SECOND));
  const words = sanitized.split(' ');
  const trimmedWords = words.slice(0, maxWords);
  const previewText = trimmedWords.join(' ');
  const estimatedDurationSeconds = Math.min(
    maxSeconds,
    Math.max(3, trimmedWords.length / APPROX_WORDS_PER_SECOND)
  );

  return { previewText, estimatedDurationSeconds };
}

export async function createOrUpdateVoice(options: {
  audioBuffer: ArrayBuffer;
  fileName: string;
  mimeType?: string;
  voiceName: string;
  existingVoiceId?: string | null;
  description?: string;
}): Promise<VoiceCloneResult> {
  ensureApiKey();

  const { audioBuffer, fileName, mimeType, voiceName, existingVoiceId, description } = options;
  const endpoint = existingVoiceId
    ? `https://api.elevenlabs.io/v1/voices/${existingVoiceId}/edit`
    : 'https://api.elevenlabs.io/v1/voices/add';
  const method = existingVoiceId ? 'POST' : 'POST';

  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: mimeType || DEFAULT_AUDIO_MIME });
  formData.append('files', audioBlob, fileName);
  if (!existingVoiceId) {
    formData.append('name', voiceName);
  }
  if (description) {
    formData.append('description', description);
  }
  if (ELEVENLABS_MODEL_ID && !existingVoiceId) {
    formData.append('model_id', ELEVENLABS_MODEL_ID);
  }
  formData.append(
    'labels',
    JSON.stringify({
      source: 'arc',
    })
  );

  const response = await fetch(endpoint, {
    method,
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY!,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to sync voice with ElevenLabs: ${errorText}`);
  }

  let value: ElevenLabsVoiceResponse | null = null;
  try {
    value = await response.json();
  } catch {
    // Some edit endpoints respond with empty body
  }

  return {
    voiceId: value?.voice_id || existingVoiceId || '',
    rawResponse: value,
  };
}

export async function synthesizePreview(options: {
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: 'mp3_44100_128' | 'mp3_44100_64' | 'wav';
  optimizeLatency?: number;
}): Promise<ArrayBuffer> {
  ensureApiKey();

  const { voiceId, text, modelId, outputFormat = 'mp3_44100_128', optimizeLatency = 1 } = options;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      Accept: DEFAULT_AUDIO_MIME,
    },
    body: JSON.stringify({
      text,
      model_id: modelId || ELEVENLABS_MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
      },
      optimize_streaming_latency: optimizeLatency,
      output_format: outputFormat,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to synthesize audio: ${errorText}`);
  }

  return await response.arrayBuffer();
}
