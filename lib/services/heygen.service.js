import { getApiKey, getUserIntegration } from './integration.service';

export async function listAvatars(apiKey) {
  const res = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'X-Api-Key': apiKey }
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let detail = `HTTP ${res.status}`;
    if (body) {
      if (typeof body.message === 'string') detail = body.message;
      else if (typeof body.error === 'string') detail = body.error;
      else if (body.error?.message) detail = body.error.message;
    }
    throw new Error(`HeyGen avatars fetch failed: ${detail}`);
  }
  
  const data = await res.json();
  const avatars = data.data?.avatars || [];
  return avatars.map(a => ({
    avatar_id: a.avatar_id,
    avatar_name: a.avatar_name || a.avatar_id,
    gender: a.gender || 'unknown',
    preview_image: a.preview_image_url || null
  }));
}

export async function listVoices(apiKey) {
  const res = await fetch('https://api.heygen.com/v2/voices', {
    headers: { 'X-Api-Key': apiKey }
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let detail = `HTTP ${res.status}`;
    if (body) {
      if (typeof body.message === 'string') detail = body.message;
      else if (typeof body.error === 'string') detail = body.error;
      else if (body.error?.message) detail = body.error.message;
    }
    throw new Error(`HeyGen voices fetch failed: ${detail}`);
  }
  
  const data = await res.json();
  const voices = data.data?.voices || [];
  return voices.map(v => ({
    voice_id: v.voice_id,
    voice_name: v.display_name || v.voice_id,
    language: v.language || 'en',
    gender: v.gender || 'unknown',
    preview_audio: v.preview_audio_url || null
  }));
}

async function resolveAvatarId(apiKey, userId) {
  const integration = await getUserIntegration(userId, 'heygen');
  const saved = integration?.config_json?.avatar_id;
  if (saved) return saved;

  const avatars = await listAvatars(apiKey);
  if (!avatars || avatars.length === 0) {
    throw new Error('No avatars found in your HeyGen account. Please create one at heygen.com or set a valid avatar_id in Integrations.');
  }
  return avatars[0].avatar_id;
}

async function resolveVoiceId(apiKey, userId) {
  const integration = await getUserIntegration(userId, 'heygen');
  const saved = integration?.config_json?.voice_id;
  if (saved) return saved;

  // Default fallback voice
  return 'en-US-JennyNeural';
}

export async function createVideo(scenes, aspectRatio, userId, customAvatarId = null, customVoiceId = null) {
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) throw new Error('HeyGen not connected. Add your API key in the Integrations page.');

  const avatarId = customAvatarId || await resolveAvatarId(apiKey, userId);
  const voiceId = customVoiceId || await resolveVoiceId(apiKey, userId);

  const dim = aspectRatio === '9:16' 
    ? { width: 1080, height: 1920 } 
    : aspectRatio === '1:1' 
      ? { width: 1080, height: 1080 } 
      : { width: 1920, height: 1080 };
  
  // Build proper HeyGen payload according to API spec
  const payload = {
    video_inputs: (scenes || []).map(s => ({
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal'
      },
      voice: {
        type: 'text',
        voice_id: voiceId,
        input_text: s.speaker_text || s.text || ''
      },
      background: {
        type: 'color',
        value: '#0D1117'
      }
    })),
    dimension: dim,
    test: false,
    caption: false
  };

  console.log('[HeyGen] Video generation request:', {
    avatar_id: avatarId,
    voice_id: voiceId,
    aspect_ratio: aspectRatio,
    dimension: dim,
    scene_count: scenes?.length || 0
  });

  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let detail = `HTTP ${res.status}`;
    if (body) {
      if (typeof body.message === 'string') detail = body.message;
      else if (typeof body.error === 'string') detail = body.error;
      else if (body.error?.message) detail = body.error.message;
    }
    
    console.error('[HeyGen] Video generation failed:', {
      status: res.status,
      error: body,
      payload_sent: payload
    });
    
    throw new Error(`HeyGen video generation failed: ${detail}`);
  }
  
  const data = await res.json();
  console.log('[HeyGen] Video generation started:', data);
  
  return { job_id: data.data?.video_id, status: 'processing' };
}

export async function getVideoStatus(jobId, userId) {
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) throw new Error('HeyGen not connected. Add your API key in the Integrations page.');
  
  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`, {
    headers: { 'X-Api-Key': apiKey }
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    let detail = `HTTP ${res.status}`;
    if (body) {
      if (typeof body.message === 'string') detail = body.message;
      else if (typeof body.error === 'string') detail = body.error;
      else if (body.error?.message) detail = body.error.message;
    }
    throw new Error(`HeyGen status check failed: ${detail}`);
  }
  
  const data = await res.json();
  return {
    job_id: jobId,
    status: data.data?.status === 'completed' ? 'completed' : 'processing',
    video_url: data.data?.video_url || null,
    error: data.data?.error || null
  };
}

// Get HeyGen-supported languages
export function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', voice_id: 'en-US-JennyNeural' },
    { code: 'es', name: 'Spanish', voice_id: 'es-ES-ElviraNeural' },
    { code: 'fr', name: 'French', voice_id: 'fr-FR-DeniseNeural' },
    { code: 'de', name: 'German', voice_id: 'de-DE-KatjaNeural' },
    { code: 'it', name: 'Italian', voice_id: 'it-IT-ElsaNeural' },
    { code: 'pt', name: 'Portuguese', voice_id: 'pt-BR-FranciscaNeural' },
    { code: 'hi', name: 'Hindi', voice_id: 'hi-IN-SwaraNeural' },
    { code: 'ja', name: 'Japanese', voice_id: 'ja-JP-NanamiNeural' },
    { code: 'ko', name: 'Korean', voice_id: 'ko-KR-SunHiNeural' },
    { code: 'zh', name: 'Chinese (Mandarin)', voice_id: 'zh-CN-XiaoxiaoNeural' },
    { code: 'ar', name: 'Arabic', voice_id: 'ar-SA-ZariyahNeural' },
    { code: 'ru', name: 'Russian', voice_id: 'ru-RU-SvetlanaNeural' },
    { code: 'nl', name: 'Dutch', voice_id: 'nl-NL-ColetteNeural' },
    { code: 'pl', name: 'Polish', voice_id: 'pl-PL-ZofiaNeural' },
    { code: 'tr', name: 'Turkish', voice_id: 'tr-TR-EmelNeural' }
  ];
}
