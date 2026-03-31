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
    avatar_name: a.avatar_name || a.avatar_id
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

export async function createVideo(scenes, aspectRatio, userId) {
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) throw new Error('HeyGen not connected. Add your API key in the Integrations page.');

  const avatarId = await resolveAvatarId(apiKey, userId);

  const dim = aspectRatio === '9:16' ? { width: 1080, height: 1920 } : aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
  
  const payload = {
    video_inputs: (scenes || []).map(s => ({
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal'
      },
      voice: {
        type: 'text',
        voice_id: 'en-US-JennyNeural',
        input_text: s.speaker_text
      },
      background: {
        type: 'color',
        value: '#0D1117'
      }
    })),
    dimension: dim
  };

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
    throw new Error(`HeyGen video generation failed: ${detail}`);
  }
  const data = await res.json();
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
    video_url: data.data?.video_url || null
  };
}
