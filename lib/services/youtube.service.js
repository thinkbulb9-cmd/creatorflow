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

export async function uploadVideo(accessToken, videoFile, metadata, onProgress) {
  /**
   * REAL YouTube Upload using Resumable Upload Protocol
   * https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
   */
  
  try {
    // Step 1: Initiate resumable upload session
    const initResponse = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/*'
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title || 'Untitled Video',
          description: metadata.description || '',
          tags: metadata.tags || [],
          categoryId: metadata.category_id || '22' // 22 = People & Blogs
        },
        status: {
          privacyStatus: metadata.privacy_status || 'private', // private, unlisted, or public
          selfDeclaredMadeForKids: false
        }
      })
    });
    
    if (!initResponse.ok) {
      const error = await initResponse.json().catch(() => ({}));
      throw new Error(`Failed to initiate upload: ${error.error?.message || initResponse.statusText}`);
    }
    
    const uploadUrl = initResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('No upload URL returned from YouTube');
    }
    
    console.log('[YouTube Upload] Upload session initiated, URL:', uploadUrl);
    
    // Step 2: Download video file from URL
    console.log('[YouTube Upload] Downloading video from:', videoFile);
    const videoResponse = await fetch(videoFile);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }
    
    const videoBlob = await videoResponse.blob();
    const videoSize = videoBlob.size;
    console.log('[YouTube Upload] Video size:', videoSize, 'bytes');
    
    // Step 3: Upload video file to YouTube
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/*',
        'Content-Length': String(videoSize)
      },
      body: videoBlob
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json().catch(() => ({}));
      throw new Error(`Upload failed: ${error.error?.message || uploadResponse.statusText}`);
    }
    
    const result = await uploadResponse.json();
    
    console.log('[YouTube Upload] SUCCESS - Video ID:', result.id);
    
    return {
      video_id: result.id,
      status: 'uploaded',
      url: `https://www.youtube.com/watch?v=${result.id}`,
      privacy_status: result.status?.privacyStatus,
      uploaded_at: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('[YouTube Upload] FAILED:', error);
    throw error;
  }
}

export async function updateVideoStatus(accessToken, videoId, privacyStatus) {
  /**
   * Update video privacy status (for publishing)
   */
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: videoId,
      status: {
        privacyStatus: privacyStatus // 'public', 'unlisted', or 'private'
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to update video status: ${error.error?.message || response.statusText}`);
  }
  
  return await response.json();
}

export async function scheduleVideo(accessToken, videoId, publishAt) {
  /**
   * REAL YouTube Video Scheduling
   * Sets publishAt time for a video
   */
  
  try {
    // Convert publishAt to ISO 8601 format if not already
    const publishTime = new Date(publishAt).toISOString();
    
    console.log('[YouTube Schedule] Scheduling video:', videoId, 'for:', publishTime);
    
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: videoId,
        status: {
          privacyStatus: 'private', // Keep private until publish time
          publishAt: publishTime,
          selfDeclaredMadeForKids: false
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Failed to schedule video: ${error.error?.message || response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('[YouTube Schedule] SUCCESS - Scheduled for:', publishTime);
    
    return {
      video_id: videoId,
      scheduled_at: publishTime,
      status: 'scheduled',
      publish_at: publishTime
    };
    
  } catch (error) {
    console.error('[YouTube Schedule] FAILED:', error);
    throw error;
  }
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
