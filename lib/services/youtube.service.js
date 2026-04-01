import { getApiKey, getUserIntegration } from './integration.service';

// YouTube OAuth Configuration
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly'
].join(' ');

export function getAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state // Pass user ID to tie callback to specific user
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error_description || 'Failed to exchange code for tokens');
  }
  
  return await response.json();
}

export async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token'
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }
  
  return await response.json();
}

export async function getChannelInfo(accessToken) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get channel info');
  }
  
  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('No YouTube channel found for this account');
  }
  
  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriber_count: channel.statistics?.subscriberCount || '0',
    video_count: channel.statistics?.videoCount || '0'
  };
}

export async function uploadVideo(accessToken, videoUrl, metadata) {
  // This is a placeholder for actual video upload
  // In production, you would:
  // 1. Download the video from videoUrl
  // 2. Upload to YouTube using resumable upload
  // 3. Set metadata (title, description, tags)
  
  // For now, returning mock response
  return {
    video_id: 'mock_video_id_' + Date.now(),
    status: 'uploaded',
    url: 'https://youtube.com/watch?v=mock'
  };
}

export async function scheduleVideo(accessToken, videoId, publishAt) {
  // This is a placeholder for actual video scheduling
  // In production, you would use YouTube API to set publish time
  
  return {
    video_id: videoId,
    scheduled_at: publishAt,
    status: 'scheduled'
  };
}

// Validate YouTube connection
export async function validateConnection(accessToken) {
  try {
    const channelInfo = await getChannelInfo(accessToken);
    return { valid: true, channel: channelInfo };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
