import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import * as openaiService from '@/lib/services/openai.service';
import * as heygenService from '@/lib/services/heygen.service';
import * as youtubeService from '@/lib/services/youtube.service';
import * as integrationService from '@/lib/services/integration.service';
import * as pipelineService from '@/lib/services/pipeline.service';
import * as validationEngine from '@/lib/services/validation-engine.service';
import * as pipelineExecutor from '@/lib/services/pipeline-executor.service';

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function errorResponse(message, code, status = 400) {
  return NextResponse.json({ success: false, error_code: code, message }, { status });
}

// ==================== AUTH ====================
async function handleRegister(req) {
  try {
    const body = await req.json();
    const { name, email, password } = body;
    if (!name || !email || !password) return errorResponse('Name, email, and password are required', 'MISSING_FIELDS');
    if (password.length < 6) return errorResponse('Password must be at least 6 characters', 'WEAK_PASSWORD');

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return errorResponse('Email already registered', 'EMAIL_EXISTS', 409);

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        name,
        email,
        password: hashedPassword,
        image: null,
        provider: 'credentials',
        created_at: new Date().toISOString()
      });

    if (insertError) throw new Error(insertError.message);

    return json({ success: true, user: { id: userId, name, email } }, 201);
  } catch (e) {
    return errorResponse(e.message, 'REGISTER_ERROR', 500);
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

    if (!concept) return errorResponse('Concept is required', 'MISSING_CONCEPT');

    const pipelineState = pipelineService.initializePipelineState();

    const project = {
      id: uuidv4(),
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
      idea_evaluation: null,
      script_data: null,
      scenes: null,
      thumbnail_data: null,
      metadata: null,
      video_job_id: null,
      video_url: null,
      youtube_video_id: null,
      youtube_url: null,
      pipeline_state: pipelineState,
      status: 'draft',
      provider_errors: [],
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabaseAdmin
      .from('projects')
      .insert(project);

    if (insertError) throw new Error(insertError.message);

    return json({ success: true, project }, 201);
  } catch (e) {
    return errorResponse(e.message, 'CREATE_ERROR', 500);
  }
}

async function handleGetProjects(userId) {
  const { data: projects, error: fetchError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (fetchError) return errorResponse(fetchError.message, 'FETCH_ERROR', 500);

  return json({ success: true, projects: projects || [] });
}

async function handleGetProject(id, userId) {
  const { data: project, error: fetchError } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (fetchError || !project) return errorResponse('Project not found', 'NOT_FOUND', 404);

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
  await supabaseAdmin
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return json({ success: true });
}

// ==================== VALIDATION ENGINE ====================
async function handleValidateProject(id, userId) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const integrations = await integrationService.getAllIntegrations(userId);

    let voices = [];
    let avatars = [];

    const heygenInt = integrations.find(i => i.provider === 'heygen' && i.is_connected);
    if (heygenInt) {
      try {
        voices = await heygenService.listVoices(heygenInt.config_json.api_key);
        avatars = await heygenService.listAvatars(heygenInt.config_json.api_key);
      } catch (e) {
        console.error('[Validation] Failed to fetch HeyGen resources:', e);
      }
    }

    const validations = await validationEngine.validateProjectReadiness(project, integrations, voices, avatars);
    const summary = validationEngine.getValidationSummary(validations);

    return json({
      success: true,
      validations,
      summary
    });
  } catch (e) {
    console.error('[Validation] Error:', e);
    return errorResponse(e.message, 'VALIDATION_ERROR', 500);
  }
}

// ==================== ONE-CLICK PIPELINE ====================
async function handleRunFullPipeline(id, userId) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    if (project.pipeline_status === 'running') {
      return errorResponse('Pipeline already running', 'ALREADY_RUNNING', 400);
    }

    const integrations = await integrationService.getAllIntegrations(userId);

    const voices = [];
    const avatars = [];

    const heygenInt = integrations.find(i => i.provider === 'heygen' && i.is_connected);
    if (heygenInt) {
      try {
        const v = await heygenService.listVoices(heygenInt.config_json.api_key);
        const a = await heygenService.listAvatars(heygenInt.config_json.api_key);
        voices.push(...v);
        avatars.push(...a);
      } catch (e) {
        return errorResponse(`HeyGen validation failed: ${e.message}`, 'HEYGEN_ERROR', 400);
      }
    }

    const validations = await validationEngine.validateProjectReadiness(project, integrations, voices, avatars);

    if (!validations.ready) {
      return json({
        success: false,
        error_code: 'VALIDATION_FAILED',
        message: 'Project validation failed. Fix issues before running pipeline.',
        validations,
        summary: validationEngine.getValidationSummary(validations)
      }, 400);
    }

    await supabaseAdmin
      .from('projects')
      .update({
        pipeline_status: 'running',
        pipeline_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    console.log(`[Pipeline] Starting full pipeline for project ${id}`);

    pipelineExecutor.executeFullPipeline(project, userId, integrations)
      .then(async (result) => {
        console.log(`[Pipeline] Pipeline finished for ${id}:`, result.status);

        await supabaseAdmin
          .from('projects')
          .update({
            ...result.project,
            pipeline_status: result.status,
            pipeline_completed_at: new Date().toISOString(),
            pipeline_results: result.results,
            updated_at: new Date().toISOString(),
            status: result.status === 'completed'
              ? (result.project.publishing_mode === 'instant' ? 'published'
                : result.project.publishing_mode === 'scheduled' ? 'scheduled' : 'draft')
              : 'failed'
          })
          .eq('id', id);
      })
      .catch(async (err) => {
        console.error(`[Pipeline] Pipeline error for ${id}:`, err);

        await supabaseAdmin
          .from('projects')
          .update({
            pipeline_status: 'failed',
            pipeline_error: err.message,
            pipeline_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'failed'
          })
          .eq('id', id);
      });

    return json({
      success: true,
      message: 'Pipeline started successfully',
      pipeline_status: 'running'
    });

  } catch (e) {
    console.error('[Pipeline] Start error:', e);
    return errorResponse(e.message, 'PIPELINE_START_ERROR', 500);
  }
}

async function handleUpdateProjectConcept(id, userId, req) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const body = await req.json();
    const { concept } = body;

    if (!concept || !concept.trim()) {
      return errorResponse('Concept cannot be empty', 'INVALID_CONCEPT', 400);
    }

    await supabaseAdmin
      .from('projects')
      .update({
        concept: concept.trim(),
        idea_evaluation: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    const { data: updated } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    return json({
      success: true,
      message: 'Concept updated successfully',
      project: updated
    });

  } catch (e) {
    console.error('[UpdateConcept] Error:', e);
    return errorResponse(e.message, 'UPDATE_CONCEPT_ERROR', 500);
  }
}


// ==================== PIPELINE STEPS WITH CACHING ====================
async function handleEvaluateIdea(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('evaluate', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

    if (!forceRegenerate && project.idea_evaluation) {
      return json({
        success: true,
        evaluation: project.idea_evaluation,
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new evaluation.'
      });
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'evaluate');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState, updated_at: new Date().toISOString() })
      .eq('id', id);

    const evaluation = await openaiService.evaluateIdea(project.concept, userId);

    const completedState = pipelineService.markStepCompleted(updatedState, 'evaluate');
    await supabaseAdmin
      .from('projects')
      .update({
        idea_evaluation: evaluation,
        pipeline_state: completedState,
        status: 'evaluated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({ success: true, evaluation, cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'evaluate', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'evaluate', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'EVALUATE_ERROR', 500);
  }
}

async function handleGenerateScript(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('script', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

    if (!forceRegenerate && project.script_data) {
      return json({
        success: true,
        script: project.script_data,
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new script.'
      });
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'script');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const script = await openaiService.generateScript(
      project.concept,
      project.duration_seconds,
      project.content_style,
      project.language,
      userId
    );

    const completedState = pipelineService.markStepCompleted(updatedState, 'script');
    await supabaseAdmin
      .from('projects')
      .update({
        script_data: script,
        pipeline_state: completedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({ success: true, script, cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'script', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'script', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'SCRIPT_ERROR', 500);
  }
}

async function handleGenerateScenes(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('scenes', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

    if (!forceRegenerate && project.scenes && project.scenes.length > 0) {
      return json({
        success: true,
        scenes: project.scenes,
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new scenes.'
      });
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'scenes');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const scriptText = project.script_data?.full_script || project.concept;
    const scenesData = await openaiService.generateScenes(
      scriptText,
      project.duration_seconds,
      project.aspect_ratio,
      userId
    );

    const scenes = scenesData.scenes || scenesData;
    const completedState = pipelineService.markStepCompleted(updatedState, 'scenes');
    await supabaseAdmin
      .from('projects')
      .update({
        scenes,
        pipeline_state: completedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({ success: true, scenes, cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'scenes', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'scenes', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'SCENES_ERROR', 500);
  }
}

async function handleGenerateVideo(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('video', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

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
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const scenes = Array.isArray(project.scenes) ? project.scenes : project.scenes?.scenes || [];
    const result = await heygenService.createVideo(
      scenes,
      project.aspect_ratio,
      userId,
      project.selected_avatar_id,
      project.selected_voice_id
    );

    await supabaseAdmin
      .from('projects')
      .update({ video_job_id: result.job_id, updated_at: new Date().toISOString() })
      .eq('id', id);

    return json({ success: true, job_id: result.job_id, status: 'processing', cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'video', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'video', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'VIDEO_ERROR', 500);
  }
}

async function handlePollVideoJob(jobId, userId) {
  try {
    const result = await heygenService.getVideoStatus(jobId, userId);

    if (result.status === 'completed' && result.video_url) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('pipeline_state')
        .eq('video_job_id', jobId)
        .eq('user_id', userId)
        .single();

      if (project) {
        const completedState = pipelineService.markStepCompleted(project.pipeline_state, 'video');
        await supabaseAdmin
          .from('projects')
          .update({
            video_url: result.video_url,
            pipeline_state: completedState,
            updated_at: new Date().toISOString()
          })
          .eq('video_job_id', jobId)
          .eq('user_id', userId);
      }
    }

    return json({ success: true, ...result });
  } catch (e) {
    return errorResponse(e.message, 'POLL_ERROR', 500);
  }
}

async function handleGenerateThumbnail(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('thumbnail', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

    if (!forceRegenerate && project.thumbnail_data && project.thumbnail_data.images) {
      return json({
        success: true,
        thumbnail_data: project.thumbnail_data,
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new thumbnails.'
      });
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'thumbnail');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const thumbnailConcept = await openaiService.generateThumbnailConcept(
      project.concept,
      project.metadata,
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
      generated_at: new Date().toISOString()
    };

    const completedState = pipelineService.markStepCompleted(updatedState, 'thumbnail');
    await supabaseAdmin
      .from('projects')
      .update({
        thumbnail_data: thumbnailData,
        pipeline_state: completedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({ success: true, thumbnail_data: thumbnailData, cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'thumbnail', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'thumbnail', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'THUMBNAIL_ERROR', 500);
  }
}

async function handleSelectThumbnail(id, userId, req) {
  try {
    const body = await req.json();
    const { selected_thumbnail_url } = body;

    if (!selected_thumbnail_url) {
      return errorResponse('Thumbnail URL is required', 'MISSING_THUMBNAIL', 400);
    }

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    if (!project.thumbnail_data || !project.thumbnail_data.images) {
      return errorResponse('Thumbnails must be generated before selection', 'NO_THUMBNAILS', 400);
    }

    const thumbnailUrls = Object.values(project.thumbnail_data.images);
    if (!thumbnailUrls.includes(selected_thumbnail_url)) {
      return errorResponse('Invalid thumbnail URL - not in generated set', 'INVALID_THUMBNAIL', 400);
    }

    const thumbnailData = {
      ...project.thumbnail_data,
      selected: selected_thumbnail_url,
      selected_at: new Date().toISOString()
    };

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    const updatedPipelineState = pipelineService.markStepCompleted(pipelineState, 'thumbnail');

    await supabaseAdmin
      .from('projects')
      .update({
        thumbnail_data: thumbnailData,
        pipeline_state: updatedPipelineState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    const progress = pipelineService.calculateProgress(updatedPipelineState);
    const currentStep = pipelineService.getCurrentStepInfo(updatedPipelineState);

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
    return errorResponse(e.message, 'SELECT_THUMBNAIL_ERROR', 500);
  }
}

async function handleGenerateMetadata(id, userId, forceRegenerate = false) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('metadata', pipelineState) && !forceRegenerate) {
      return errorResponse('Previous steps must be completed first', 'DEPENDENCY_ERROR', 400);
    }

    if (!forceRegenerate && project.metadata) {
      return json({
        success: true,
        metadata: project.metadata,
        cached: true,
        message: 'Loaded from cache. Click "Regenerate" to create new metadata.'
      });
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'metadata');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const metadata = await openaiService.generateMetadata(
      project.concept,
      project.script_data?.full_script,
      userId
    );

    const completedState = pipelineService.markStepCompleted(updatedState, 'metadata');
    await supabaseAdmin
      .from('projects')
      .update({
        metadata,
        pipeline_state: completedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({ success: true, metadata, cached: false });
  } catch (e) {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'metadata', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          provider_errors: [...currentErrors, { step: 'metadata', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }
    return errorResponse(e.message, 'METADATA_ERROR', 500);
  }
}

async function handlePublishYoutube(id, userId) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (!pipelineService.canRunStep('upload', pipelineState)) {
      return errorResponse('Previous steps must be completed first. Complete metadata generation before upload.', 'DEPENDENCY_ERROR', 400);
    }

    if (!project.video_url) {
      return errorResponse('No video file found. Generate video first.', 'NO_VIDEO', 400);
    }

    if (!project.metadata || !project.metadata.title) {
      return errorResponse('No metadata found. Generate metadata first.', 'NO_METADATA', 400);
    }

    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');

    if (!ytInt) {
      return errorResponse('YouTube not connected. Please connect your YouTube account in Integrations.', 'YOUTUBE_NOT_CONNECTED', 403);
    }

    const accessToken = ytInt.config_json?.access_token;
    const refreshToken = ytInt.config_json?.refresh_token;
    const expiresAt = ytInt.config_json?.expires_at;
    const clientId = ytInt.config_json?.client_id;
    const clientSecret = ytInt.config_json?.client_secret;

    if (!accessToken) {
      return errorResponse(
        'No access token found. YouTube authentication incomplete. Please reconnect YouTube in Integrations.',
        'NO_ACCESS_TOKEN',
        403
      );
    }

    let finalAccessToken = accessToken;
    const now = Date.now();
    const isExpired = expiresAt ? now >= (expiresAt - 300000) : true;

    if (isExpired) {
      if (!refreshToken) {
        return errorResponse(
          'Access token expired and no refresh token available. Please reconnect YouTube in Integrations.',
          'TOKEN_EXPIRED_NO_REFRESH',
          403
        );
      }

      if (!clientId || !clientSecret) {
        return errorResponse(
          'YouTube OAuth credentials incomplete. Please reconnect YouTube in Integrations.',
          'MISSING_OAUTH_CREDENTIALS',
          403
        );
      }

      try {
        const newTokens = await youtubeService.refreshAccessToken(refreshToken, clientId, clientSecret);
        finalAccessToken = newTokens.access_token;

        await supabaseAdmin
          .from('integrations')
          .update({
            config_json: {
              ...ytInt.config_json,
              access_token: newTokens.access_token,
              expires_at: Date.now() + (newTokens.expires_in * 1000),
              refresh_token: newTokens.refresh_token || refreshToken
            },
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('provider', 'youtube');
      } catch (refreshError) {
        return errorResponse(
          `YouTube authentication expired and refresh failed: ${refreshError.message}. Please reconnect YouTube in Integrations.`,
          'TOKEN_REFRESH_FAILED',
          403
        );
      }
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'upload');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const uploadResult = await youtubeService.uploadVideo(
      finalAccessToken,
      project.video_url,
      {
        title: project.metadata.title,
        description: project.metadata.description,
        tags: project.metadata.tags,
        category_id: '22',
        privacy_status: project.publishing_mode === 'instant' ? 'public' : 'private'
      }
    );

    const completedState = pipelineService.markStepCompleted(updatedState, 'upload');

    await supabaseAdmin
      .from('projects')
      .update({
        youtube_video_id: uploadResult.video_id,
        youtube_url: uploadResult.url,
        upload_status: 'uploaded',
        uploaded_at: uploadResult.uploaded_at,
        pipeline_state: completedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (project.publishing_mode === 'instant') {
      const instantPublishState = pipelineService.markStepCompleted(completedState, 'schedule');
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: instantPublishState,
          published_at: new Date().toISOString(),
          status: 'published'
        })
        .eq('id', id);
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
    console.error('[YouTube Upload] Error:', e.message);

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'upload', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          upload_status: 'failed',
          upload_error: e.message,
          provider_errors: [...currentErrors, { step: 'upload', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }

    return errorResponse(e.message, 'UPLOAD_ERROR', 500);
  }
}

async function handleScheduleYoutube(id, userId) {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!project) return errorResponse('Project not found', 'NOT_FOUND', 404);

    if (project.publishing_mode !== 'scheduled') {
      return errorResponse('Schedule publishing is only available for Scheduled mode projects.', 'INVALID_MODE', 400);
    }

    const pipelineState = project.pipeline_state || pipelineService.initializePipelineState();
    if (pipelineState.upload?.status !== 'completed') {
      return errorResponse('Video must be uploaded to YouTube before scheduling. Complete Upload step first.', 'UPLOAD_NOT_COMPLETE', 400);
    }

    if (!project.youtube_video_id || project.youtube_video_id.startsWith('mock_')) {
      return errorResponse('No real YouTube video ID found. Upload must complete successfully first.', 'NO_REAL_VIDEO_ID', 400);
    }

    if (!project.schedule_date || !project.schedule_time) {
      return errorResponse('Schedule date and time are required for scheduled publishing.', 'MISSING_SCHEDULE', 400);
    }

    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    if (!ytInt || !ytInt.config_json?.access_token) {
      return errorResponse('YouTube not connected. Please connect your YouTube account in Integrations.', 'YOUTUBE_NOT_CONNECTED', 403);
    }

    const accessToken = ytInt.config_json.access_token;
    const scheduleDateTime = new Date(`${project.schedule_date}T${project.schedule_time}`);

    if (scheduleDateTime <= new Date()) {
      return errorResponse('Schedule time must be in the future.', 'INVALID_SCHEDULE_TIME', 400);
    }

    const updatedState = pipelineService.markStepRunning(pipelineState, 'schedule');
    await supabaseAdmin
      .from('projects')
      .update({ pipeline_state: updatedState })
      .eq('id', id);

    const scheduleResult = await youtubeService.scheduleVideo(
      accessToken,
      project.youtube_video_id,
      scheduleDateTime
    );

    const completedState = pipelineService.markStepCompleted(updatedState, 'schedule');

    await supabaseAdmin
      .from('projects')
      .update({
        schedule_status: 'scheduled',
        scheduled_at: scheduleResult.scheduled_at,
        publish_at: scheduleResult.publish_at,
        pipeline_state: completedState,
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return json({
      success: true,
      scheduled_at: scheduleResult.scheduled_at,
      publish_at: scheduleResult.publish_at,
      status: 'scheduled',
      message: `Video scheduled to publish on ${scheduleDateTime.toLocaleString()}`
    });

  } catch (e) {
    console.error('[YouTube Schedule] FAILED:', e);

    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('pipeline_state, provider_errors')
      .eq('id', id)
      .single();

    if (project) {
      const failedState = pipelineService.markStepFailed(project.pipeline_state, 'schedule', e.message);
      const currentErrors = project.provider_errors || [];
      await supabaseAdmin
        .from('projects')
        .update({
          pipeline_state: failedState,
          schedule_status: 'failed',
          schedule_error: e.message,
          provider_errors: [...currentErrors, { step: 'schedule', error: e.message, timestamp: new Date().toISOString() }]
        })
        .eq('id', id);
    }

    return errorResponse(e.message, 'SCHEDULE_ERROR', 500);
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
    if (!provider || !config_json) return errorResponse('Provider and config required', 'MISSING_FIELDS');

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
    return errorResponse(e.message, 'SAVE_ERROR', 500);
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
      await supabaseAdmin
        .from('integrations')
        .update({ is_connected: validation.valid, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', provider);
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
      return errorResponse('HeyGen not connected', 'NOT_CONFIGURED', 400);
    }

    const voices = await heygenService.listVoices(int.config_json.api_key);
    return json({ success: true, voices, current_voice_id: int.config_json?.voice_id || null });
  } catch (e) {
    return errorResponse(e.message, 'VOICES_ERROR', 500);
  }
}

async function handleGetAvatars(userId) {
  try {
    const int = await integrationService.getUserIntegration(userId, 'heygen');
    if (!int?.config_json?.api_key) {
      return errorResponse('HeyGen not connected', 'NOT_CONFIGURED', 400);
    }

    const avatars = await heygenService.listAvatars(int.config_json.api_key);
    return json({ success: true, avatars, current_avatar_id: int.config_json?.avatar_id || null });
  } catch (e) {
    return errorResponse(e.message, 'AVATARS_ERROR', 500);
  }
}

// ==================== LANGUAGES ====================
async function handleGetLanguages() {
  const languages = heygenService.getSupportedLanguages();
  return json({ success: true, languages });
}

// ==================== ANALYTICS ====================
async function handleGetAnalytics(userId, timeframe = '7d') {
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const projectList = projects || [];

  const analytics = {
    views: Math.floor(Math.random() * 50000) + 10000,
    clicks: Math.floor(Math.random() * 5000) + 1000,
    shares: Math.floor(Math.random() * 500) + 100,
    watch_time: Math.floor(Math.random() * 100000) + 20000,
    published_videos: projectList.filter(p => p.youtube_video_id).length,
    scheduled_videos: projectList.filter(p => p.status === 'scheduled').length,
    timeframe,
    chart_data: Array.from({ length: timeframe === '7d' ? 7 : 30 }, (_, i) => ({
      date: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
      views: Math.floor(Math.random() * 5000) + 1000,
      clicks: Math.floor(Math.random() * 500) + 100
    })).reverse(),
    is_mock: true
  };

  return json({ success: true, analytics });
}

// ==================== DASHBOARD ====================
async function handleDashboardStats(userId) {
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const projectList = projects || [];
  const total = projectList.length;

  const inProgress = projectList.filter(p => {
    const pipelineState = p.pipeline_state || {};
    const hasStarted = Object.values(pipelineState).some(s => s.status === 'running' || s.status === 'completed');
    const allCompleted = Object.values(pipelineState).every(s => s.status === 'completed');
    return hasStarted && !allCompleted;
  }).length;

  const completed = projectList.filter(p => {
    const pipelineState = p.pipeline_state || {};
    return Object.values(pipelineState).every(s => s.status === 'completed');
  }).length;

  const scheduled = projectList.filter(p => p.status === 'scheduled').length;

  const failed = projectList.filter(p => {
    const pipelineState = p.pipeline_state || {};
    return Object.values(pipelineState).some(s => s.status === 'failed');
  }).length;

  return json({
    success: true,
    stats: { total, in_progress: inProgress, completed, scheduled, failed },
    recent_projects: projectList.slice(0, 5)
  });
}

// ==================== YOUTUBE OAUTH ====================
async function handleYoutubeAuth(userId) {
  try {
    const integration = await integrationService.getUserIntegration(userId, 'youtube');
    const clientId = integration?.config_json?.client_id;
    const clientSecret = integration?.config_json?.client_secret;

    if (!clientId || !clientSecret) {
      return errorResponse('YouTube credentials not found. Please save your Client ID and Client Secret in the Integrations tab first.', 'NOT_CONFIGURED');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/youtube/callback`;

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const authUrl = youtubeService.getAuthUrl(clientId, redirectUri, state);

    return json({ success: true, auth_url: authUrl });
  } catch (e) {
    console.error('[YouTube OAuth] Start error:', e);
    return errorResponse(e.message, 'AUTH_ERROR', 500);
  }
}

async function handleYoutubeCallback(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error_param = searchParams.get('error');

    if (error_param) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${baseUrl}/?youtube_callback=error&message=${encodeURIComponent(error_param)}`);
    }

    if (!code) {
      return errorResponse('Missing authorization code', 'MISSING_CODE');
    }

    if (!state) {
      return errorResponse('Missing state parameter - invalid OAuth flow', 'MISSING_STATE');
    }

    let userId;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      userId = stateData.userId;
    } catch (e) {
      return errorResponse('Invalid state parameter', 'INVALID_STATE');
    }

    const integration = await integrationService.getUserIntegration(userId, 'youtube');

    if (!integration?.config_json?.client_id || !integration?.config_json?.client_secret) {
      return errorResponse('YouTube credentials not found. Please save your Client ID and Client Secret in the Integrations tab first.', 'NOT_CONFIGURED');
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/youtube/callback`;

    const tokens = await youtubeService.exchangeCodeForTokens(
      code,
      integration.config_json.client_id,
      integration.config_json.client_secret,
      redirectUri
    );

    const channelInfo = await youtubeService.getChannelInfo(tokens.access_token);

    const tokenData = {
      ...integration.config_json,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      channel_info: channelInfo
    };

    await supabaseAdmin
      .from('integrations')
      .update({
        config_json: tokenData,
        is_connected: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('provider', 'youtube');

    return NextResponse.redirect(`${baseUrl}/?youtube_callback=success&channel=${encodeURIComponent(channelInfo.title)}`);
  } catch (e) {
    console.error('[YouTube OAuth] Callback error:', e);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/?youtube_callback=error&message=${encodeURIComponent(e.message)}`);
  }
}

// ==================== SETTINGS ====================
async function handleGetSettings(userId) {
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (!user) return errorResponse('User not found', 'NOT_FOUND', 404);

  const settings = user.settings || {
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

    await supabaseAdmin
      .from('users')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', userId);

    return json({ success: true, settings });
  } catch (e) {
    return errorResponse(e.message, 'SAVE_SETTINGS_ERROR', 500);
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
    return errorResponse(e.message, 'CONNECTION_STATUS_ERROR', 500);
  }
}

// ==================== ROUTE HANDLER ====================
export async function GET(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams?.path || [];

  // Public routes
  if (path[0] === 'health') return json({ status: 'ok' });
  if (path[0] === 'youtube' && path[1] === 'callback') return handleYoutubeCallback(request);
  if (path[0] === 'languages') return handleGetLanguages();

  // Protected routes
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;

  if (path[0] === 'projects' && path.length === 1) return handleGetProjects(userId);
  if (path[0] === 'projects' && path.length === 2) return handleGetProject(path[1], userId);
  if (path[0] === 'projects' && path.length === 3 && path[2] === 'validate') return handleValidateProject(path[1], userId);
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

  return errorResponse('Not found', 'NOT_FOUND', 404);
}

export async function POST(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams?.path || [];

  // Public routes
  if (path[0] === 'register') return handleRegister(request);

  // Protected routes
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;

  if (path[0] === 'projects' && path.length === 1) return handleCreateProject(request, userId);

  if (path[0] === 'projects' && path.length === 3) {
    const id = path[1];
    const action = path[2];

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
    if (action === 'run-pipeline') return handleRunFullPipeline(id, userId);
  }

  if (path[0] === 'integrations' && path[1] === 'test') return handleTestIntegration(request, userId);
  if (path[0] === 'integrations' && path.length === 1) return handleSaveIntegration(request, userId);
  if (path[0] === 'settings') return handleSaveSettings(request, userId);

  return errorResponse('Not found', 'NOT_FOUND', 404);
}

export async function DELETE(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams?.path || [];

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;

  if (path[0] === 'projects' && path.length === 2) return handleDeleteProject(path[1], userId);
  if (path[0] === 'integrations' && path.length === 2) return handleDeleteIntegration(path[1], userId);

  return errorResponse('Not found', 'NOT_FOUND', 404);
}

export async function PATCH(request, { params }) {
  const resolvedParams = await params;
  const path = resolvedParams?.path || [];

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;

  if (path[0] === 'projects' && path.length === 3 && path[2] === 'update-concept') {
    return handleUpdateProjectConcept(path[1], userId, request);
  }

  return errorResponse('Not found', 'NOT_FOUND', 404);
}
