import { getUserIntegration } from './integration.service';
import { v4 as uuidv4 } from 'uuid';

function getMockUpload() {
  return { video_id: `mock-yt-${uuidv4().substring(0, 8)}`, status: 'uploaded', url: 'https://youtube.com/watch?v=mock123', is_mock: true };
}

function getMockSchedule(publishAt) {
  return { success: true, scheduled_at: publishAt || new Date().toISOString(), is_mock: true };
}

export function getAuthUrl(clientId, redirectUri) {
  const scopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'].join(' ');
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
}

export async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  if (!res.ok) throw new Error('Failed to exchange code');
  return res.json();
}

export async function uploadVideo(accessToken, videoUrl, metadata) {
  if (!accessToken) return getMockUpload();
  try {
    const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { title: metadata?.title || 'Untitled', description: metadata?.description || '', tags: metadata?.tags || [], categoryId: '22' }, status: { privacyStatus: 'private' } })
    });
    if (!res.ok) throw new Error(`YouTube error: ${res.status}`);
    const data = await res.json();
    return { video_id: data.id, status: 'uploaded', url: `https://youtube.com/watch?v=${data.id}`, is_mock: false };
  } catch (e) { console.error('uploadVideo:', e.message); return { ...getMockUpload(), error: e.message }; }
}

export async function scheduleVideo(accessToken, videoId, publishAt) {
  if (!accessToken || videoId?.startsWith('mock-yt-')) return getMockSchedule(publishAt);
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=status', {
      method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: videoId, status: { privacyStatus: 'private', publishAt } })
    });
    if (!res.ok) throw new Error(`YouTube error: ${res.status}`);
    return { success: true, scheduled_at: publishAt, is_mock: false };
  } catch (e) { console.error('scheduleVideo:', e.message); return { ...getMockSchedule(publishAt), error: e.message }; }
}
