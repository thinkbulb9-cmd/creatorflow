import { getUserIntegration } from './integration.service';

export function getAuthUrl(clientId, redirectUri) {
  const scopes = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube'].join(' ');
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
}

export async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error_description || 'Failed to exchange authorization code');
  }
  return res.json();
}

export async function uploadVideo(accessToken, videoUrl, metadata) {
  if (!accessToken) throw new Error('YouTube not connected. Complete OAuth in the Integrations page.');
  const res = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snippet: { title: metadata?.title || 'Untitled', description: metadata?.description || '', tags: metadata?.tags || [], categoryId: '22' },
      status: { privacyStatus: 'private' }
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `YouTube upload error: ${res.status}`);
  }
  const data = await res.json();
  return { video_id: data.id, status: 'uploaded', url: `https://youtube.com/watch?v=${data.id}` };
}

export async function scheduleVideo(accessToken, videoId, publishAt) {
  if (!accessToken) throw new Error('YouTube not connected. Complete OAuth in the Integrations page.');
  if (!videoId) throw new Error('No video ID to schedule.');
  const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=status', {
    method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: videoId, status: { privacyStatus: 'private', publishAt } })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `YouTube schedule error: ${res.status}`);
  }
  return { success: true, scheduled_at: publishAt };
}
