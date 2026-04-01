import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as openaiService from '@/lib/services/openai.service';
import * as heygenService from '@/lib/services/heygen.service';
import * as youtubeService from '@/lib/services/youtube.service';
import * as integrationService from '@/lib/services/integration.service';
import * as pipelineService from '@/lib/services/pipeline.service';

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function error(message, code, status = 400) {
  return NextResponse.json({ success: false, error_code: code, message }, { status });
}

// ==================== AUTH ====================
async function handleRegister(req) {
  try {
    const body = await req.json();
    const { name, email, password } = body;
    if (!name || !email || !password) return error('Name, email, and password are required', 'MISSING_FIELDS');
    if (password.length < 6) return error('Password must be at least 6 characters', 'WEAK_PASSWORD');
    
    const db = await getDb();
    const existing = await db.collection('users').findOne({ email });
    if (existing) return error('Email already registered', 'EMAIL_EXISTS', 409);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    await db.collection('users').insertOne({
      _id: userId, 
      name, 
      email, 
      password: hashedPassword,
      image: null, 
      provider: 'credentials', 
      created_at: new Date()
    });
    
    return json({ success: true, user: { id: userId, name, email } }, 201);
  } catch (e) { 
    return error(e.message, 'REGISTER_ERROR', 500); 
  }
}

// ==================== PROJECTS ====================
async function handleCreateProject(req, userId) {
  try {
    const body = await req.json();
    const { 
      concept, 
      duration_seconds, 
      aspect_ratio, 
      language, 
      content_style, 
      publishing_mode, 
      schedule_date,
      schedule_time,
      selected_voice_id,
      selected_avatar_id
    } = body;
    
    if (!concept) return error('Concept is required', 'MISSING_CONCEPT');
    
    const db = await getDb();
    
    // Initialize pipeline state
    const pipelineState = pipelineService.initializePipelineState();
    
    const project = {
      _id: uuidv4(), 
      user_id: userId, 
      concept,
      duration_seconds: parseInt(duration_seconds) || 60,
      aspect_ratio: aspect_ratio || '16:9', 
      language: language || 'English',
      content_style: content_style || 'professional', 
      publishing_mode: publishing_mode || 'draft',
      schedule_date: schedule_date || null,
      schedule_time: schedule_time || null,
      selected_voice_id: selected_voice_id || null,
      selected_avatar_id: selected_avatar_id || null,
      
      // Cached results
      idea_evaluation: null, 
      script_data: null, 
      scenes: null,
      thumbnail_data: null,
      metadata: null,
      
      // Video status
      video_job_id: null, 
      video_url: null,
      
      // YouTube status
      youtube_video_id: null,
      
      // Pipeline state
      pipeline_state: pipelineState,
      status: 'draft',
      
      // Errors
      provider_errors: [],
      error_message: null,
      
      // Timestamps
      created_at: new Date(), 
      updated_at: new Date()
    };
    
    await db.collection('projects').insertOne(project);
    return json({ success: true, project }, 201);
  } catch (e) { 
    return error(e.message, 'CREATE_ERROR', 500); 
  }
}

async function handleGetProjects(userId) {
  const db = await getDb();
  const projects = await db.collection('projects')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  return json({ success: true, projects });
}

async function handleGetProject(id, userId) {
  const db = await getDb();
  const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
  if (!project) return error('Project not found', 'NOT_FOUND', 404);
  
  // Calculate progress
  const progress = pipelineService.calculateProgress(project.pipeline_state || {});
  const currentStep = pipelineService.getCurrentStepInfo(project.pipeline_state || {});
  
  return json({ 
    success: true, 
    project,
    progress,
    current_step: currentStep
  });
}

async function handleDeleteProject(id, userId) {
  const db = await getDb();
  await db.collection('projects').deleteOne({ _id: id, user_id: userId });
  return json({ success: true });
}

//  ==================== PIPELINE STEPS WITH CACHING ====================
async function handleEvaluateIdea(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    // Check if we can run this step
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('evaluate', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache unless force regenerate
    if (!forceRegenerate && project.idea_evaluation) {
      return json({ 
        success: true, 
        evaluation: project.idea_evaluation, 
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new evaluation.'
      });
    }
    
    // Mark step as running
    const updatedState = pipelineService.markStepRunning(pipelineState, 'evaluate');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { pipeline_state: updatedState, updated_at: new Date() } }
    );
    
    // Generate evaluation
    const evaluation = await openaiService.evaluateIdea(project.concept, userId);
    
    // Mark step as completed
    const completedState = pipelineService.markStepCompleted(updatedState, 'evaluate');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { 
        $set: { 
          idea_evaluation: evaluation, 
          pipeline_state: completedState,
          status: 'evaluated', 
          updated_at: new Date() 
        } 
      }
    );
    
    return json({ success: true, evaluation, cached: false });
  } catch (e) {
    // Mark step as failed
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'evaluate', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'evaluate', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'EVALUATE_ERROR', 500);
  }
}

async function handleGenerateScript(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('script', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache
    if (!forceRegenerate && project.script_data) {
      return json({ 
        success: true, 
        script: project.script_data, 
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new script.'
      });
    }
    
    const updatedState = pipelineService.markStepRunning(pipelineState, 'script');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    const script = await openaiService.generateScript(
      project.concept, 
      project.duration_seconds, 
      project.content_style, 
      project.language, 
      userId
    );
    
    const completedState = pipelineService.markStepCompleted(updatedState, 'script');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { script_data: script, pipeline_state: completedState, updated_at: new Date() } }
    );
    
    return json({ success: true, script, cached: false });
  } catch (e) {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'script', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'script', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'SCRIPT_ERROR', 500);
  }
}

async function handleGenerateScenes(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('scenes', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache
    if (!forceRegenerate && project.scenes && project.scenes.length > 0) {
      return json({ 
        success: true, 
        scenes: project.scenes, 
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new scenes.'
      });
    }
    
    const updatedState = pipelineService.markStepRunning(pipelineState, 'scenes');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    const scriptText = project.script_data?.full_script || project.concept;
    const scenesData = await openaiService.generateScenes(
      scriptText, 
      project.duration_seconds, 
      project.aspect_ratio, 
      userId
    );
    
    const scenes = scenesData.scenes || scenesData;
    const completedState = pipelineService.markStepCompleted(updatedState, 'scenes');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { scenes, pipeline_state: completedState, updated_at: new Date() } }
    );
    
    return json({ success: true, scenes, cached: false });
  } catch (e) {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'scenes', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'scenes', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'SCENES_ERROR', 500);
  }
}

async function handleGenerateVideo(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('video', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache
    if (!forceRegenerate && project.video_url) {
      return json({ 
        success: true, 
        video_url: project.video_url,
        job_id: project.video_job_id,
        cached: true,
        message: 'Video already generated. Click "Regenerate" to create new video.'
      });
    }
    
    const updatedState = pipelineService.markStepRunning(pipelineState, 'video');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    const scenes = Array.isArray(project.scenes) ? project.scenes : project.scenes?.scenes || [];
    const result = await heygenService.createVideo(
      scenes, 
      project.aspect_ratio, 
      userId,
      project.selected_avatar_id,
      project.selected_voice_id
    );
    
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { video_job_id: result.job_id, updated_at: new Date() } }
    );
    
    return json({ success: true, job_id: result.job_id, status: 'processing', cached: false });
  } catch (e) {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'video', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'video', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'VIDEO_ERROR', 500);
  }
}

async function handlePollVideoJob(jobId, userId) {
  try {
    const result = await heygenService.getVideoStatus(jobId, userId);
    
    if (result.status === 'completed' && result.video_url) {
      const db = await getDb();
      const project = await db.collection('projects').findOne({ video_job_id: jobId, user_id: userId });
      
      if (project) {
        const completedState = pipelineService.markStepCompleted(project.pipeline_state, 'video');
        await db.collection('projects').updateOne(
          { video_job_id: jobId, user_id: userId },
          { $set: { video_url: result.video_url, pipeline_state: completedState, updated_at: new Date() } }
        );
      }
    }
    
    return json({ success: true, ...result });
  } catch (e) { 
    return error(e.message, 'POLL_ERROR', 500); 
  }
}

async function handleGenerateThumbnail(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('thumbnail', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache
    if (!forceRegenerate && project.thumbnail_data && project.thumbnail_data.images) {
      return json({ 
        success: true, 
        thumbnail_data: project.thumbnail_data, 
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new thumbnails.'
      });
    }
    
    const updatedState = pipelineService.markStepRunning(pipelineState, 'thumbnail');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    // Step 1: Generate strategic thumbnail concept
    const thumbnailConcept = await openaiService.generateThumbnailConcept(
      project.concept,
      project.metadata,
      userId
    );
    
    // Step 2: Generate thumbnail images using the strategic prompts
    const images = await openaiService.generateThumbnail(
      thumbnailConcept,
      ['16:9', '9:16', '1:1'],
      userId
    );
    
    const thumbnailData = {
      concept: thumbnailConcept,
      images: images,
      selected: images['16:9'], // Default to 16:9
      generated_at: new Date()
    };
    
    const completedState = pipelineService.markStepCompleted(updatedState, 'thumbnail');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { thumbnail_data: thumbnailData, pipeline_state: completedState, updated_at: new Date() } }
    );
    
    return json({ success: true, thumbnail_data: thumbnailData, cached: false });
  } catch (e) {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'thumbnail', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'thumbnail', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'THUMBNAIL_ERROR', 500);
  }
}

async function handleSelectThumbnail(id, userId, req) {
  try {
    const body = await req.json();
    const { selected_thumbnail_url } = body;
    
    if (!selected_thumbnail_url) {
      return error('Thumbnail URL is required', 'MISSING_THUMBNAIL', 400);
    }
    
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    // Validate that thumbnail was actually generated
    if (!project.thumbnail_data || !project.thumbnail_data.images) {
      return error('Thumbnails must be generated before selection', 'NO_THUMBNAILS', 400);
    }
    
    // Validate selected URL is one of the generated thumbnails
    const thumbnailUrls = Object.values(project.thumbnail_data.images);
    if (!thumbnailUrls.includes(selected_thumbnail_url)) {
      return error('Invalid thumbnail URL - not in generated set', 'INVALID_THUMBNAIL', 400);
    }
    
    console.log('[Thumbnail Selection] User selected:', selected_thumbnail_url);
    
    // Update thumbnail data with selection
    const thumbnailData = { 
      ...project.thumbnail_data, 
      selected: selected_thumbnail_url,
      selected_at: new Date().toISOString()
    };
    
    // CRITICAL: Mark thumbnail step as COMPLETED in pipeline state
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    const updatedPipelineState = pipelineService.markStepCompleted(pipelineState, 'thumbnail');
    
    console.log('[Thumbnail Selection] Marking thumbnail step as COMPLETED');
    console.log('[Thumbnail Selection] Next step (metadata) should now be unlocked');
    
    // Update project with both thumbnail data AND completed pipeline state
    await db.collection('projects').updateOne(
      { _id: id },
      { 
        $set: { 
          thumbnail_data: thumbnailData,
          pipeline_state: updatedPipelineState,
          updated_at: new Date() 
        } 
      }
    );
    
    // Get updated progress
    const progress = pipelineService.calculateProgress(updatedPipelineState);
    const currentStep = pipelineService.getCurrentStepInfo(updatedPipelineState);
    
    console.log('[Thumbnail Selection] Pipeline progress:', progress);
    console.log('[Thumbnail Selection] Current active step:', currentStep.name);
    
    return json({ 
      success: true, 
      thumbnail_data: thumbnailData,
      pipeline_state: updatedPipelineState,
      progress,
      current_step: currentStep,
      message: 'Thumbnail selected and pipeline advanced to next step'
    });
  } catch (e) {
    console.error('[Thumbnail Selection] Error:', e);
    return error(e.message, 'SELECT_THUMBNAIL_ERROR', 500);
  }
}

async function handleGenerateMetadata(id, userId, forceRegenerate = false) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('metadata', pipelineState) && !forceRegenerate) {
      return error('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }
    
    // Check cache
    if (!forceRegenerate && project.metadata) {
      return json({ 
        success: true, 
        metadata: project.metadata, 
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new metadata.'
      });
    }
    
    const updatedState = pipelineService.markStepRunning(pipelineState, 'metadata');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    const metadata = await openaiService.generateMetadata(
      project.concept, 
      project.script_data?.full_script, 
      userId
    );
    
    const completedState = pipelineService.markStepCompleted(updatedState, 'metadata');
    await db.collection('projects').updateOne(
      { _id: id }, 
      { $set: { metadata, pipeline_state: completedState, updated_at: new Date() } }
    );
    
    return json({ success: true, metadata, cached: false });
  } catch (e) {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'metadata', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { pipeline_state: failedState },
          $push: { provider_errors: { step: 'metadata', error: e.message, timestamp: new Date() } }
        }
      );
    }
    return error(e.message, 'METADATA_ERROR', 500);
  }
}

async function handlePublishYoutube(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    // Validate pipeline dependencies
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('upload', pipelineState)) {
      return error('Previous steps must be completed first. Complete metadata generation before upload.', 'DEPENDENCY_ERROR', 400);
    }
    
    // STRICT: Check if video URL exists
    if (!project.video_url) {
      return error('No video file found. Generate video first.', 'NO_VIDEO', 400);
    }
    
    // STRICT: Check if metadata exists
    if (!project.metadata || !project.metadata.title) {
      return error('No metadata found. Generate metadata first.', 'NO_METADATA', 400);
    }
    
    // STRICT: Check YouTube OAuth
    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    if (!ytInt || !ytInt.config_json?.access_token) {
      return error('YouTube not connected. Please connect your YouTube account in Integrations.', 'YOUTUBE_NOT_CONNECTED', 403);
    }
    
    const accessToken = ytInt.config_json.access_token;
    
    console.log('[YouTube Upload] Starting REAL upload for project:', id);
    console.log('[YouTube Upload] Video URL:', project.video_url);
    console.log('[YouTube Upload] Metadata:', project.metadata.title);
    
    // Mark step as running
    const updatedState = pipelineService.markStepRunning(pipelineState, 'upload');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    // REAL YouTube Upload - No Mocks
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
    
    console.log('[YouTube Upload] SUCCESS - Real video ID:', uploadResult.video_id);
    
    // Mark step as completed with REAL data
    const completedState = pipelineService.markStepCompleted(updatedState, 'upload');
    
    await db.collection('projects').updateOne(
      { _id: id }, 
      { 
        $set: { 
          youtube_video_id: uploadResult.video_id,
          youtube_url: uploadResult.url,
          upload_status: 'uploaded',
          uploaded_at: uploadResult.uploaded_at,
          pipeline_state: completedState, 
          updated_at: new Date() 
        } 
      }
    );
    
    // If instant publish mode, also mark schedule as completed
    if (project.publishing_mode === 'instant') {
      const instantPublishState = pipelineService.markStepCompleted(completedState, 'schedule');
      await db.collection('projects').updateOne(
        { _id: id },
        {
          $set: {
            pipeline_state: instantPublishState,
            published_at: new Date(),
            status: 'published'
          }
        }
      );
    }
    
    return json({ 
      success: true, 
      video_id: uploadResult.video_id,
      url: uploadResult.url,
      uploaded_at: uploadResult.uploaded_at,
      status: uploadResult.status,
      message: 'Video uploaded successfully to YouTube!'
    });
    
  } catch (e) {
    console.error('[YouTube Upload] FAILED:', e);
    
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'upload', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        { 
          $set: { 
            pipeline_state: failedState,
            upload_status: 'failed',
            upload_error: e.message
          },
          $push: { 
            provider_errors: { 
              step: 'upload', 
              error: e.message, 
              timestamp: new Date() 
            } 
          }
        }
      );
    }
    
    return error(e.message, 'UPLOAD_ERROR', 500);
  }
}

async function handleScheduleYoutube(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    
    // STRICT: Only allow scheduling for scheduled mode
    if (project.publishing_mode !== 'scheduled') {
      return error('Schedule publishing is only available for Scheduled mode projects.', 'INVALID_MODE', 400);
    }
    
    // STRICT: Validate upload completed first
    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (pipelineState.upload?.status !== 'completed') {
      return error('Video must be uploaded to YouTube before scheduling. Complete Upload step first.', 'UPLOAD_NOT_COMPLETE', 400);
    }
    
    // STRICT: Check if real YouTube video ID exists
    if (!project.youtube_video_id || project.youtube_video_id.startsWith('mock_')) {
      return error('No real YouTube video ID found. Upload must complete successfully first.', 'NO_REAL_VIDEO_ID', 400);
    }
    
    // STRICT: Check if schedule date/time exists
    if (!project.schedule_date || !project.schedule_time) {
      return error('Schedule date and time are required for scheduled publishing.', 'MISSING_SCHEDULE', 400);
    }
    
    // STRICT: Check YouTube OAuth
    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    if (!ytInt || !ytInt.config_json?.access_token) {
      return error('YouTube not connected. Please connect your YouTube account in Integrations.', 'YOUTUBE_NOT_CONNECTED', 403);
    }
    
    const accessToken = ytInt.config_json.access_token;
    
    // Combine date and time into ISO timestamp
    const scheduleDateTime = new Date(`${project.schedule_date}T${project.schedule_time}`);
    
    // Validate future date
    if (scheduleDateTime <= new Date()) {
      return error('Schedule time must be in the future.', 'INVALID_SCHEDULE_TIME', 400);
    }
    
    console.log('[YouTube Schedule] Scheduling video:', project.youtube_video_id);
    console.log('[YouTube Schedule] Publish at:', scheduleDateTime.toISOString());
    
    // Mark step as running
    const updatedState = pipelineService.markStepRunning(pipelineState, 'schedule');
    await db.collection('projects').updateOne({ _id: id }, { $set: { pipeline_state: updatedState } });
    
    // REAL YouTube Scheduling
    const scheduleResult = await youtubeService.scheduleVideo(
      accessToken,
      project.youtube_video_id,
      scheduleDateTime
    );
    
    console.log('[YouTube Schedule] SUCCESS - Scheduled for:', scheduleResult.publish_at);
    
    // Mark step as completed
    const completedState = pipelineService.markStepCompleted(updatedState, 'schedule');
    
    await db.collection('projects').updateOne(
      { _id: id },
      {
        $set: {
          schedule_status: 'scheduled',
          scheduled_at: scheduleResult.scheduled_at,
          publish_at: scheduleResult.publish_at,
          pipeline_state: completedState,
          status: 'scheduled',
          updated_at: new Date()
        }
      }
    );
    
    return json({
      success: true,
      scheduled_at: scheduleResult.scheduled_at,
      publish_at: scheduleResult.publish_at,
      status: 'scheduled',
      message: `Video scheduled to publish on ${scheduleDateTime.toLocaleString()}`
    });
    
  } catch (e) {
    console.error('[YouTube Schedule] FAILED:', e);
    
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id });
    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'schedule', e.message);
      await db.collection('projects').updateOne(
        { _id: id },
        {
          $set: {
            pipeline_state: failedState,
            schedule_status: 'failed',
            schedule_error: e.message
          },
          $push: {
            provider_errors: {
              step: 'schedule',
              error: e.message,
              timestamp: new Date()
            }
          }
        }
      );
    }
    
    return error(e.message, 'SCHEDULE_ERROR', 500);
  }
}

// ==================== INTEGRATIONS ====================
async function handleGetIntegrations(userId) {
  const integrations = await integrationService.getAllIntegrations(userId);
  return json({ success: true, integrations });
}

async function validateApiKey(provider, configJson) {
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${configJson.api_key}` }
      });
      return { valid: res.ok, message: res.ok ? 'Connected successfully' : `Invalid API key (${res.status})` };
    }
    
    if (provider === 'heygen') {
      const res = await fetch('https://api.heygen.com/v2/avatars', {
        headers: { 'X-Api-Key': configJson.api_key }
      });
      const body = await res.json().catch(() => null);
      
      if (res.ok) {
        const avatars = body?.data?.avatars || [];
        const firstAvatar = avatars.length > 0 ? avatars[0].avatar_id : null;
        return {
          valid: true,
          message: `Connected successfully. ${avatars.length} avatar(s) found.`,
          avatars: avatars.slice(0, 20).map(a => ({ 
            avatar_id: a.avatar_id, 
            avatar_name: a.avatar_name || a.avatar_id,
            gender: a.gender
          })),
          default_avatar_id: firstAvatar
        };
      }
      
      let detail = 'Invalid API key';
      if (body) {
        if (typeof body.message === 'string') detail = body.message;
        else if (typeof body.error === 'string') detail = body.error;
        else if (body.error?.message) detail = body.error.message;
        else if (body.code) detail = `Error code: ${body.code}`;
        else detail = `HTTP ${res.status} - Authentication failed`;
      }
      return { valid: false, message: `HeyGen: ${detail}` };
    }
    
    if (provider === 'youtube') {
      return { valid: true, message: 'YouTube credentials saved. Use Connect OAuth to authorize.' };
    }
    
    return { valid: true, message: 'Saved' };
  } catch (e) {
    return { valid: false, message: `Validation error: ${e.message}` };
  }
}

async function handleSaveIntegration(req, userId) {
  try {
    const body = await req.json();
    const { provider, config_json } = body;
    if (!provider || !config_json) return error('Provider and config required', 'MISSING_FIELDS');

    const validation = await validateApiKey(provider, config_json);

    const finalConfig = { ...config_json };
    if (provider === 'heygen' && validation.valid && validation.default_avatar_id && !config_json.avatar_id) {
      finalConfig.avatar_id = validation.default_avatar_id;
    }

    const result = await integrationService.saveIntegration(userId, provider, finalConfig, validation.valid);
    return json({
      success: true, 
      integration: result, 
      connected: validation.valid, 
      message: validation.message,
      ...(validation.avatars ? { avatars: validation.avatars } : {})
    });
  } catch (e) { 
    return error(e.message, 'SAVE_ERROR', 500); 
  }
}

async function handleDeleteIntegration(provider, userId) {
  await integrationService.deleteIntegration(userId, provider);
  return json({ success: true });
}

async function handleTestIntegration(req, userId) {
  try {
    const body = await req.json();
    const { provider } = body;
    const integration = await integrationService.getUserIntegration(userId, provider);
    
    if (!integration) return json({ success: true, connected: false, message: 'Not configured' });
    
    const apiKey = integration.config_json?.api_key;
    if (!apiKey && provider !== 'youtube') {
      return json({ success: true, connected: false, message: 'No API key found' });
    }

    const validation = await validateApiKey(provider, integration.config_json);

    if (validation.valid !== integration.is_connected) {
      const db = await getDb();
      await db.collection('integrations').updateOne(
        { user_id: userId, provider },
        { $set: { is_connected: validation.valid, updated_at: new Date() } }
      );
    }

    return json({ success: true, connected: validation.valid, message: validation.message });
  } catch (e) { 
    return json({ success: true, connected: false, message: e.message }); 
  }
}

// ==================== HEYGEN VOICES & AVATARS ====================
async function handleGetVoices(userId) {
  try {
    const int = await integrationService.getUserIntegration(userId, 'heygen');
    if (!int?.config_json?.api_key) {
      return error('HeyGen not connected', 'NOT_CONFIGURED', 400);
    }
    
    const voices = await heygenService.listVoices(int.config_json.api_key);
    return json({ success: true, voices, current_voice_id: int.config_json?.voice_id || null });
  } catch (e) { 
    return error(e.message, 'VOICES_ERROR', 500); 
  }
}

async function handleGetAvatars(userId) {
  try {
    const int = await integrationService.getUserIntegration(userId, 'heygen');
    if (!int?.config_json?.api_key) {
      return error('HeyGen not connected', 'NOT_CONFIGURED', 400);
    }
    
    const avatars = await heygenService.listAvatars(int.config_json.api_key);
    return json({ success: true, avatars, current_avatar_id: int.config_json?.avatar_id || null });
  } catch (e) { 
    return error(e.message, 'AVATARS_ERROR', 500); 
  }
}

// ==================== LANGUAGES ====================
async function handleGetLanguages() {
  const languages = heygenService.getSupportedLanguages();
  return json({ success: true, languages });
}

// ==================== ANALYTICS ====================
async function handleGetAnalytics(userId, timeframe = '7d') {
  const db = await getDb();
  const projects = await db.collection('projects')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  
  // Mock analytics data (ready for real YouTube Analytics API integration)
  const analytics = {
    views: Math.floor(Math.random() * 50000) + 10000,
    clicks: Math.floor(Math.random() * 5000) + 1000,
    shares: Math.floor(Math.random() * 500) + 100,
    watch_time: Math.floor(Math.random() * 100000) + 20000, // seconds
    published_videos: projects.filter(p => p.youtube_video_id).length,
    scheduled_videos: projects.filter(p => p.status === 'scheduled').length,
    timeframe,
    
    // Sample chart data
    chart_data: Array.from({ length: timeframe === '7d' ? 7 : 30 }, (_, i) => ({
      date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      views: Math.floor(Math.random() * 5000) + 1000,
      clicks: Math.floor(Math.random() * 500) + 100
    })).reverse(),
    
    is_mock: true // Flag to indicate this is mock data
  };
  
  return json({ success: true, analytics });
}

// ==================== DASHBOARD ====================
async function handleDashboardStats(userId) {
  const db = await getDb();
  const projects = await db.collection('projects')
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  
  const total = projects.length;
  
  // Count based on pipeline state
  const inProgress = projects.filter(p => {
    const pipelineState = p.pipeline_state || {};
    const hasStarted = Object.values(pipelineState).some(s => s.status === 'running' || s.status === 'completed');
    const allCompleted = Object.values(pipelineState).every(s => s.status === 'completed');
    return hasStarted && !allCompleted;
  }).length;
  
  const completed = projects.filter(p => {
    const pipelineState = p.pipeline_state || {};
    return Object.values(pipelineState).every(s => s.status === 'completed');
  }).length;
  
  const scheduled = projects.filter(p => p.status === 'scheduled').length;
  
  const failed = projects.filter(p => {
    const pipelineState = p.pipeline_state || {};
    return Object.values(pipelineState).some(s => s.status === 'failed');
  }).length;
  
  return json({ 
    success: true, 
    stats: { total, in_progress: inProgress, completed, scheduled, failed }, 
    recent_projects: projects.slice(0, 5) 
  });
}

// ==================== YOUTUBE OAUTH ====================
async function handleYoutubeAuth(userId) {
  try {
    // Get saved YouTube credentials
    const integration = await integrationService.getUserIntegration(userId, 'youtube');
    const clientId = integration?.config_json?.client_id;
    const clientSecret = integration?.config_json?.client_secret;
    
    if (!clientId || !clientSecret) {
      return error('YouTube credentials not found. Please save your Client ID and Client Secret in the Integrations tab first.', 'NOT_CONFIGURED');
    }
    
    // Generate auth URL with state containing userId
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/youtube/callback`;
    
    // Use userId as state to identify user in callback
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const authUrl = youtubeService.getAuthUrl(clientId, redirectUri, state);
    
    console.log('[YouTube OAuth] Starting OAuth for user:', userId);
    return json({ success: true, auth_url: authUrl });
  } catch (e) {
    console.error('[YouTube OAuth] Start error:', e);
    return error(e.message, 'AUTH_ERROR', 500);
  }
}

async function handleYoutubeCallback(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error_param = searchParams.get('error');
    
    console.log('[YouTube OAuth] Callback received');
    
    // Check for OAuth errors
    if (error_param) {
      console.error('[YouTube OAuth] User denied or error:', error_param);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/?youtube_callback=error&message=${encodeURIComponent(error_param)}`);
    }
    
    // Validate code and state
    if (!code) {
      console.error('[YouTube OAuth] Missing authorization code');
      return error('Missing authorization code', 'MISSING_CODE');
    }
    
    if (!state) {
      console.error('[YouTube OAuth] Missing state parameter');
      return error('Missing state parameter - invalid OAuth flow', 'MISSING_STATE');
    }
    
    // Decode state to get userId
    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.userId;
      console.log('[YouTube OAuth] Decoded userId from state:', userId);
    } catch (e) {
      console.error('[YouTube OAuth] Failed to decode state:', e);
      return error('Invalid state parameter', 'INVALID_STATE');
    }
    
    // Get YouTube integration to retrieve client credentials
    const integration = await integrationService.getUserIntegration(userId, 'youtube');
    
    if (!integration?.config_json?.client_id || !integration?.config_json?.client_secret) {
      console.error('[YouTube OAuth] Credentials not found for user:', userId);
      console.error('[YouTube OAuth] Integration:', JSON.stringify(integration, null, 2));
      return error('YouTube credentials not found. Please save your Client ID and Client Secret in the Integrations tab first.', 'NOT_CONFIGURED');
    }
    
    console.log('[YouTube OAuth] Found credentials for user:', userId);
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/youtube/callback`;
    
    // Exchange code for tokens
    console.log('[YouTube OAuth] Exchanging code for tokens...');
    const tokens = await youtubeService.exchangeCodeForTokens(
      code,
      integration.config_json.client_id,
      integration.config_json.client_secret,
      redirectUri
    );
    
    console.log('[YouTube OAuth] Tokens received successfully');
    
    // Get channel info
    console.log('[YouTube OAuth] Fetching channel info...');
    const channelInfo = await youtubeService.getChannelInfo(tokens.access_token);
    
    console.log('[YouTube OAuth] Channel info received:', channelInfo.title);
    
    // Save tokens and channel info to integration
    const db = await getDb();
    await db.collection('integrations').updateOne(
      { user_id: userId, provider: 'youtube' },
      {
        $set: {
          config_json: {
            ...integration.config_json,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type,
            expires_in: tokens.expires_in,
            expires_at: Date.now() + (tokens.expires_in * 1000),
            channel_info: channelInfo
          },
          is_connected: true,
          updated_at: new Date()
        }
      }
    );
    
    console.log('[YouTube OAuth] Integration updated successfully');
    
    // Redirect back to app with success
    return NextResponse.redirect(`${baseUrl}/?youtube_callback=success&channel=${encodeURIComponent(channelInfo.title)}`);
  } catch (e) { 
    console.error('[YouTube OAuth] Callback error:', e);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/?youtube_callback=error&message=${encodeURIComponent(e.message)}`);
  }
}

// ==================== SETTINGS ====================
async function handleGetSettings(userId) {
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: userId });
  
  const settings = user?.settings || {
    theme: 'dark',
    default_language: 'English',
    default_aspect_ratio: '16:9',
    default_publishing_mode: 'draft',
    default_avatar_id: null,
    default_voice_id: null
  };
  
  return json({ success: true, settings, user: { name: user.name, email: user.email, image: user.image } });
}

async function handleSaveSettings(req, userId) {
  try {
    const body = await req.json();
    const { settings } = body;
    
    const db = await getDb();
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { settings, updated_at: new Date() } }
    );
    
    return json({ success: true, settings });
  } catch (e) {
    return error(e.message, 'SAVE_SETTINGS_ERROR', 500);
  }
}

// ==================== YOUTUBE CONNECTION STATUS ====================
async function handleYoutubeConnectionStatus(userId) {
  try {
    const integration = await integrationService.getUserIntegration(userId, 'youtube');
    const isConnected = integration?.is_connected || false;
    const hasCredentials = !!(integration?.config_json?.client_id && integration?.config_json?.client_secret);
    const hasAccessToken = !!integration?.config_json?.access_token;
    
    return json({
      success: true,
      connected: isConnected,
      has_credentials: hasCredentials,
      has_access_token: hasAccessToken,
      requires_oauth: hasCredentials && !hasAccessToken,
      channel_info: integration?.config_json?.channel_info || null
    });
  } catch (e) {
    return error(e.message, 'CONNECTION_STATUS_ERROR', 500);
  }
}

// ==================== ROUTE HANDLER ====================
export async function GET(request, { params }) {
  const path = params?.path || [];
  
  // Public routes
  if (path[0] === 'health') return json({ status: 'ok' });
  if (path[0] === 'youtube' && path[1] === 'callback') return handleYoutubeCallback(request);
  if (path[0] === 'languages') return handleGetLanguages();
  
  // Protected routes
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return error('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;
  
  if (path[0] === 'projects' && path.length === 1) return handleGetProjects(userId);
  if (path[0] === 'projects' && path.length === 2) return handleGetProject(path[1], userId);
  if (path[0] === 'integrations') return handleGetIntegrations(userId);
  if (path[0] === 'dashboard' && path[1] === 'stats') return handleDashboardStats(userId);
  if (path[0] === 'analytics') {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '7d';
    return handleGetAnalytics(userId, timeframe);
  }
  if (path[0] === 'youtube' && path[1] === 'auth') return handleYoutubeAuth(userId);
  if (path[0] === 'heygen' && path[1] === 'avatars') return handleGetAvatars(userId);
  if (path[0] === 'heygen' && path[1] === 'voices') return handleGetVoices(userId);
  if (path[0] === 'video-jobs' && path.length === 3 && path[2] === 'poll') {
    return handlePollVideoJob(path[1], userId);
  }
  if (path[0] === 'settings') return handleGetSettings(userId);
  if (path[0] === 'youtube' && path[1] === 'connection-status') return handleYoutubeConnectionStatus(userId);
  
  return error('Not found', 'NOT_FOUND', 404);
}

export async function POST(request, { params }) {
  const path = params?.path || [];
  
  // Public routes
  if (path[0] === 'register') return handleRegister(request);
  
  // Protected routes
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return error('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;
  
  if (path[0] === 'projects' && path.length === 1) return handleCreateProject(request, userId);
  
  if (path[0] === 'projects' && path.length === 3) {
    const id = path[1];
    const action = path[2];
    
    // Check for regenerate flag
    const body = await request.clone().json().catch(() => ({}));
    const forceRegenerate = body.regenerate === true;
    
    if (action === 'evaluate') return handleEvaluateIdea(id, userId, forceRegenerate);
    if (action === 'generate-script') return handleGenerateScript(id, userId, forceRegenerate);
    if (action === 'generate-scenes') return handleGenerateScenes(id, userId, forceRegenerate);
    if (action === 'generate-video') return handleGenerateVideo(id, userId, forceRegenerate);
    if (action === 'generate-thumbnail') return handleGenerateThumbnail(id, userId, forceRegenerate);
    if (action === 'select-thumbnail') return handleSelectThumbnail(id, userId, request);
    if (action === 'generate-metadata') return handleGenerateMetadata(id, userId, forceRegenerate);
    if (action === 'publish-youtube') return handlePublishYoutube(id, userId);
    if (action === 'schedule-youtube') return handleScheduleYoutube(id, userId);
  }
  
  if (path[0] === 'integrations' && path[1] === 'test') return handleTestIntegration(request, userId);
  if (path[0] === 'integrations' && path.length === 1) return handleSaveIntegration(request, userId);
  if (path[0] === 'settings') return handleSaveSettings(request, userId);
  
  return error('Not found', 'NOT_FOUND', 404);
}

export async function DELETE(request, { params }) {
  const path = params?.path || [];
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return error('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;
  
  if (path[0] === 'projects' && path.length === 2) return handleDeleteProject(path[1], userId);
  if (path[0] === 'integrations' && path.length === 2) return handleDeleteIntegration(path[1], userId);
  
  return error('Not found', 'NOT_FOUND', 404);
}
