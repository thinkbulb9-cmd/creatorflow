import { getApiKey } from './integration.service';

export async function createVideo(scenes, aspectRatio, userId) {
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) throw new Error('HeyGen not connected. Add your API key in the Integrations page.');
  const dim = aspectRatio === '9:16' ? { width: 1080, height: 1920 } : aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
  const res = await fetch('https://api.heygen.com/v2/video/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({
      video_inputs: (scenes || []).map(s => ({
        character: { type: 'avatar', avatar_id: 'default' },
        voice: { type: 'text', voice_id: 'en-US-JennyNeural', input_text: s.speaker_text },
        background: { type: 'color', value: '#0D1117' }
      })), dimension: dim
    })
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
