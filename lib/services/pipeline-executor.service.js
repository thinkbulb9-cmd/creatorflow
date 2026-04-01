/**
 * PIPELINE EXECUTION ENGINE
 * One-click full pipeline execution with error handling
 */

import * as openaiService from './openai.service.js';
import * as heygenService from './heygen.service.js';
import * as youtubeService from './youtube.service.js';
import * as pipelineService from './pipeline.service.js';

export async function executeFullPipeline(project, userId, integrations) {
  const steps = [
    { key: 'evaluate', name: 'Idea Evaluation', handler: executeEvaluate },
    { key: 'script', name: 'Script Generation', handler: executeScript },
    { key: 'scenes', name: 'Scene Creation', handler: executeScenes },
    { key: 'video', name: 'Video Generation', handler: executeVideo },
    { key: 'thumbnail', name: 'Thumbnail Generation', handler: executeThumbnail },
    { key: 'metadata', name: 'Metadata Generation', handler: executeMetadata }
  ];

  // Add publishing steps based on mode
  if (project.publishing_mode === 'scheduled' || project.publishing_mode === 'instant') {
    steps.push({ key: 'upload', name: 'YouTube Upload', handler: executeUpload });
  }
  
  if (project.publishing_mode === 'scheduled') {
    steps.push({ key: 'schedule', name: 'Schedule Publishing', handler: executeSchedule });
  }

  const results = {
    project_id: project._id,
    started_at: new Date(),
    completed_at: null,
    status: 'running',
    steps_completed: 0,
    steps_total: steps.length,
    current_step: null,
    failed_step: null,
    error: null,
    step_results: {}
  };

  let updatedProject = { ...project };

  try {
    for (const step of steps) {
      results.current_step = step.key;
      
      console.log(`[Pipeline] Starting step: ${step.name}`);
      
      try {
        const stepResult = await step.handler(updatedProject, userId, integrations);
        updatedProject = stepResult.project;
        results.step_results[step.key] = {
          status: 'completed',
          completed_at: new Date(),
          data: stepResult.data
        };
        results.steps_completed++;
        
        console.log(`[Pipeline] ✅ ${step.name} completed`);
      } catch (error) {
        console.error(`[Pipeline] ❌ ${step.name} failed:`, error);
        
        results.status = 'failed';
        results.failed_step = step.key;
        results.error = {
          step: step.key,
          message: error.message,
          provider_error: error.provider_error || null
        };
        
        throw error;
      }
    }

    results.status = 'completed';
    results.completed_at = new Date();
    
    console.log('[Pipeline] ✅ Full pipeline completed successfully');
    
    return { success: true, results, project: updatedProject };
    
  } catch (error) {
    results.completed_at = new Date();
    
    console.error('[Pipeline] ❌ Pipeline failed:', error);
    
    return { 
      success: false, 
      results, 
      project: updatedProject,
      error: results.error 
    };
  }
}

async function executeEvaluate(project, userId, integrations) {
  const evaluation = await openaiService.evaluateIdea(
    project.concept,
    project.duration_seconds,
    project.aspect_ratio,
    userId
  );
  
  return {
    project: { ...project, idea_evaluation: evaluation },
    data: evaluation
  };
}

async function executeScript(project, userId, integrations) {
  const script = await openaiService.generateScript(
    project.idea_evaluation || { concept: project.concept, score: 8 },
    project.duration_seconds,
    project.language,
    project.content_style,
    userId
  );
  
  return {
    project: { ...project, script_data: script },
    data: script
  };
}

async function executeScenes(project, userId, integrations) {
  const scenes = await openaiService.generateScenes(
    project.script_data,
    project.duration_seconds,
    project.aspect_ratio,
    project.language,
    userId
  );
  
  return {
    project: { ...project, scenes: scenes.scenes },
    data: scenes
  };
}

async function executeVideo(project, userId, integrations) {
  const heygenInt = integrations.find(i => i.provider === 'heygen' && i.is_connected);
  if (!heygenInt) {
    throw new Error('HeyGen not connected');
  }
  
  const apiKey = heygenInt.config_json?.api_key;
  
  // Get voice and avatar
  let voiceId = project.selected_voice_id;
  let avatarId = project.selected_avatar_id;
  
  if (!voiceId || !avatarId) {
    // Auto-select based on language
    const voices = await heygenService.listVoices(apiKey);
    const avatars = await heygenService.listAvatars(apiKey);
    
    const matchingVoice = voices.find(v => v.language?.toLowerCase() === project.language?.toLowerCase());
    if (!matchingVoice) {
      throw new Error(`No voice found for language: ${project.language}`);
    }
    
    voiceId = matchingVoice.voice_id;
    avatarId = avatars[0]?.avatar_id;
    
    if (!avatarId) {
      throw new Error('No avatar available');
    }
  }
  
  const videoResult = await heygenService.createVideo(
    project.scenes,
    project.aspect_ratio,
    userId,
    avatarId,
    voiceId
  );
  
  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max
  
  while (attempts < maxAttempts) {
    const status = await heygenService.getVideoStatus(videoResult.video_id, userId);
    
    if (status.status === 'completed' && status.video_url) {
      return {
        project: { 
          ...project, 
          video_url: status.video_url,
          video_job_id: videoResult.video_id 
        },
        data: { video_url: status.video_url, video_id: videoResult.video_id }
      };
    }
    
    if (status.status === 'failed') {
      throw new Error(`HeyGen video generation failed: ${status.error || 'Unknown error'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  throw new Error('Video generation timeout');
}

async function executeThumbnail(project, userId, integrations) {
  const thumbnailConcept = await openaiService.generateThumbnailConcept(
    project.concept,
    project.metadata || { title: project.concept },
    userId
  );
  
  const images = await openaiService.generateThumbnail(
    thumbnailConcept,
    ['16:9', '9:16', '1:1'],
    userId
  );
  
  const thumbnailData = {
    concept: thumbnailConcept,
    images: images,
    selected: images['16:9'],
    generated_at: new Date()
  };
  
  return {
    project: { ...project, thumbnail_data: thumbnailData },
    data: thumbnailData
  };
}

async function executeMetadata(project, userId, integrations) {
  const metadata = await openaiService.generateMetadata(
    project.script_data,
    project.scenes,
    project.language,
    userId
  );
  
  return {
    project: { ...project, metadata },
    data: metadata
  };
}

async function executeUpload(project, userId, integrations) {
  const ytInt = integrations.find(i => i.provider === 'youtube');
  if (!ytInt || !ytInt.config_json?.access_token) {
    throw new Error('YouTube not connected');
  }
  
  const accessToken = ytInt.config_json.access_token;
  
  const uploadResult = await youtubeService.uploadVideo(
    accessToken,
    project.video_url,
    {
      title: project.metadata.title,
      description: project.metadata.description,
      tags: project.metadata.tags,
      category_id: '22',
      privacy_status: project.publishing_mode === 'instant' ? 'public' : 'private'
    }
  );
  
  return {
    project: {
      ...project,
      youtube_video_id: uploadResult.video_id,
      youtube_url: uploadResult.url,
      uploaded_at: uploadResult.uploaded_at
    },
    data: uploadResult
  };
}

async function executeSchedule(project, userId, integrations) {
  const ytInt = integrations.find(i => i.provider === 'youtube');
  if (!ytInt || !ytInt.config_json?.access_token) {
    throw new Error('YouTube not connected');
  }
  
  const accessToken = ytInt.config_json.access_token;
  const scheduleDateTime = new Date(`${project.schedule_date}T${project.schedule_time}`);
  
  const scheduleResult = await youtubeService.scheduleVideo(
    accessToken,
    project.youtube_video_id,
    scheduleDateTime
  );
  
  return {
    project: {
      ...project,
      scheduled_at: scheduleResult.scheduled_at,
      publish_at: scheduleResult.publish_at,
      status: 'scheduled'
    },
    data: scheduleResult
  };
}
