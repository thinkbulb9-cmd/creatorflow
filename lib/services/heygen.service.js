import { getApiKey } from './integration.service';
import { v4 as uuidv4 } from 'uuid';

function getMockVideoJob() {
  return { job_id: `mock-job-${uuidv4().substring(0, 8)}`, status: 'processing', is_mock: true };
}

function getMockVideoStatus(jobId) {
  return { job_id: jobId, status: 'completed', video_url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', is_mock: true };
}

export async function createVideo(scenes, aspectRatio, userId) {
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) return getMockVideoJob();
  try {
    const dim = aspectRatio === '9:16' ? { width: 1080, height: 1920 } : aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
    const res = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        video_inputs: (scenes || []).map(s => ({
          character: { type: 'avatar', avatar_id: 'default' },
          voice: { type: 'text', input_text: s.speaker_text },
          background: { type: 'color', value: '#0D1117' }
        })), dimension: dim
      })
    });
    if (!res.ok) throw new Error(`HeyGen error: ${res.status}`);
    const data = await res.json();
    return { job_id: data.data?.video_id, status: 'processing', is_mock: false };
  } catch (e) { console.error('createVideo:', e.message); return { ...getMockVideoJob(), error: e.message }; }
}

export async function getVideoStatus(jobId, userId) {
  if (jobId?.startsWith('mock-job-')) return getMockVideoStatus(jobId);
  const apiKey = await getApiKey(userId, 'heygen');
  if (!apiKey) return getMockVideoStatus(jobId);
  try {
    const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${jobId}`, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) throw new Error(`HeyGen error: ${res.status}`);
    const data = await res.json();
    return { job_id: jobId, status: data.data?.status === 'completed' ? 'completed' : 'processing', video_url: data.data?.video_url || null, is_mock: false };
  } catch (e) { console.error('getVideoStatus:', e.message); return { ...getMockVideoStatus(jobId), error: e.message }; }
}
