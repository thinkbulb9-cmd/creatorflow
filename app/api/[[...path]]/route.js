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
      _id: userId, name, email, password: hashedPassword,
      image: null, provider: 'credentials', created_at: new Date()
    });
    return json({ success: true, user: { id: userId, name, email } }, 201);
  } catch (e) { return error(e.message, 'REGISTER_ERROR', 500); }
}

// ==================== PROJECTS ====================
async function handleCreateProject(req, userId) {
  try {
    const body = await req.json();
    const { concept, duration_seconds, aspect_ratio, language, content_style, publishing_mode, schedule_at } = body;
    if (!concept) return error('Concept is required', 'MISSING_CONCEPT');
    const db = await getDb();
    const project = {
      _id: uuidv4(), user_id: userId, concept,
      duration_seconds: parseInt(duration_seconds) || 60,
      aspect_ratio: aspect_ratio || '16:9', language: language || 'English',
      content_style: content_style || 'professional', publishing_mode: publishing_mode || 'draft',
      schedule_at: schedule_at || null, status: 'submitted',
      idea_evaluation: null, script: null, scenes: null,
      video_job_id: null, video_url: null, metadata: null,
      youtube_video_id: null, error_message: null,
      created_at: new Date(), updated_at: new Date()
    };
    await db.collection('projects').insertOne(project);
    return json({ success: true, project }, 201);
  } catch (e) { return error(e.message, 'CREATE_ERROR', 500); }
}

async function handleGetProjects(userId) {
  const db = await getDb();
  const projects = await db.collection('projects').find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  return json({ success: true, projects });
}

async function handleGetProject(id, userId) {
  const db = await getDb();
  const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
  if (!project) return error('Project not found', 'NOT_FOUND', 404);
  return json({ success: true, project });
}

async function handleDeleteProject(id, userId) {
  const db = await getDb();
  await db.collection('projects').deleteOne({ _id: id, user_id: userId });
  return json({ success: true });
}

// ==================== PIPELINE STEPS ====================
async function handleEvaluateIdea(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const evaluation = await openaiService.evaluateIdea(project.concept, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { idea_evaluation: evaluation, status: 'idea_evaluated', updated_at: new Date() } });
    return json({ success: true, evaluation, status: 'idea_evaluated' });
  } catch (e) { return error(e.message, 'EVALUATE_ERROR', 500); }
}

async function handleGenerateScript(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const script = await openaiService.generateScript(project.concept, project.duration_seconds, project.content_style, project.language, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { script, status: 'script_ready', updated_at: new Date() } });
    return json({ success: true, script, status: 'script_ready' });
  } catch (e) { return error(e.message, 'SCRIPT_ERROR', 500); }
}

async function handleGenerateScenes(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const scriptText = project.script?.full_script || project.concept;
    const scenesData = await openaiService.generateScenes(scriptText, project.duration_seconds, project.aspect_ratio, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { scenes: scenesData.scenes || scenesData, status: 'scenes_ready', updated_at: new Date() } });
    return json({ success: true, scenes: scenesData, status: 'scenes_ready' });
  } catch (e) { return error(e.message, 'SCENES_ERROR', 500); }
}

async function handleGenerateVideo(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const scenes = Array.isArray(project.scenes) ? project.scenes : project.scenes?.scenes || [];
    const result = await heygenService.createVideo(scenes, project.aspect_ratio, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { video_job_id: result.job_id, status: 'video_generating', updated_at: new Date() } });
    return json({ success: true, job_id: result.job_id, status: 'video_generating' });
  } catch (e) { return error(e.message, 'VIDEO_ERROR', 500); }
}

async function handlePollVideoJob(jobId, userId) {
  try {
    const result = await heygenService.getVideoStatus(jobId, userId);
    if (result.status === 'completed' && result.video_url) {
      const db = await getDb();
      await db.collection('projects').updateOne(
        { video_job_id: jobId, user_id: userId },
        { $set: { video_url: result.video_url, status: 'video_ready', updated_at: new Date() } }
      );
    }
    return json({ success: true, ...result });
  } catch (e) { return error(e.message, 'POLL_ERROR', 500); }
}

async function handleGenerateMetadata(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const metadata = await openaiService.generateMetadata(project.concept, project.script?.full_script, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { metadata, status: 'metadata_ready', updated_at: new Date() } });
    return json({ success: true, metadata, status: 'metadata_ready' });
  } catch (e) { return error(e.message, 'METADATA_ERROR', 500); }
}

async function handlePublishYoutube(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    const accessToken = ytInt?.config_json?.access_token;
    const result = await youtubeService.uploadVideo(accessToken, project.video_url, project.metadata || {});
    await db.collection('projects').updateOne({ _id: id }, { $set: { youtube_video_id: result.video_id, status: 'youtube_uploaded', updated_at: new Date() } });
    return json({ success: true, ...result, status: 'youtube_uploaded' });
  } catch (e) { return error(e.message, 'UPLOAD_ERROR', 500); }
}

async function handleScheduleYoutube(id, userId) {
  try {
    const db = await getDb();
    const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
    if (!project) return error('Project not found', 'NOT_FOUND', 404);
    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    const accessToken = ytInt?.config_json?.access_token;
    const result = await youtubeService.scheduleVideo(accessToken, project.youtube_video_id, project.schedule_at);
    await db.collection('projects').updateOne({ _id: id }, { $set: { status: 'scheduled', updated_at: new Date() } });
    return json({ success: true, ...result, status: 'scheduled' });
  } catch (e) { return error(e.message, 'SCHEDULE_ERROR', 500); }
}

async function handleRunPipeline(id, userId) {
  const db = await getDb();
  const project = await db.collection('projects').findOne({ _id: id, user_id: userId });
  if (!project) return error('Project not found', 'NOT_FOUND', 404);
  try {
    const evaluation = await openaiService.evaluateIdea(project.concept, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { idea_evaluation: evaluation, status: 'idea_evaluated', updated_at: new Date() } });

    const script = await openaiService.generateScript(project.concept, project.duration_seconds, project.content_style, project.language, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { script, status: 'script_ready', updated_at: new Date() } });

    const scenesData = await openaiService.generateScenes(script.full_script, project.duration_seconds, project.aspect_ratio, userId);
    const scenes = scenesData.scenes || scenesData;
    await db.collection('projects').updateOne({ _id: id }, { $set: { scenes, status: 'scenes_ready', updated_at: new Date() } });

    const videoResult = await heygenService.createVideo(Array.isArray(scenes) ? scenes : [], project.aspect_ratio, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { video_job_id: videoResult.job_id, status: 'video_generating', updated_at: new Date() } });

    const videoStatus = await heygenService.getVideoStatus(videoResult.job_id, userId);
    if (videoStatus.status === 'completed') {
      await db.collection('projects').updateOne({ _id: id }, { $set: { video_url: videoStatus.video_url, status: 'video_ready', updated_at: new Date() } });
    } else {
      const updated = await db.collection('projects').findOne({ _id: id });
      return json({ success: true, project: updated, message: 'Video still generating' });
    }

    const metadata = await openaiService.generateMetadata(project.concept, script.full_script, userId);
    await db.collection('projects').updateOne({ _id: id }, { $set: { metadata, status: 'metadata_ready', updated_at: new Date() } });

    const ytInt = await integrationService.getUserIntegration(userId, 'youtube');
    const accessToken = ytInt?.config_json?.access_token;
    const uploadResult = await youtubeService.uploadVideo(accessToken, videoStatus.video_url, metadata);
    await db.collection('projects').updateOne({ _id: id }, { $set: { youtube_video_id: uploadResult.video_id, status: 'youtube_uploaded', updated_at: new Date() } });

    if (project.publishing_mode === 'scheduled' && project.schedule_at) {
      await youtubeService.scheduleVideo(accessToken, uploadResult.video_id, project.schedule_at);
      await db.collection('projects').updateOne({ _id: id }, { $set: { status: 'scheduled', updated_at: new Date() } });
    }

    const updated = await db.collection('projects').findOne({ _id: id });
    return json({ success: true, project: updated });
  } catch (e) {
    await db.collection('projects').updateOne({ _id: id }, { $set: { status: 'failed', error_message: e.message, updated_at: new Date() } });
    return error(e.message, 'PIPELINE_ERROR', 500);
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
      if (res.ok) return { valid: true, message: 'Connected successfully' };
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
    const result = await integrationService.saveIntegration(userId, provider, config_json, validation.valid);
    return json({ success: true, integration: result, connected: validation.valid, message: validation.message });
  } catch (e) { return error(e.message, 'SAVE_ERROR', 500); }
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
    if (!apiKey && provider !== 'youtube') return json({ success: true, connected: false, message: 'No API key found' });

    const validation = await validateApiKey(provider, integration.config_json);

    if (validation.valid !== integration.is_connected) {
      const db = await getDb();
      await db.collection('integrations').updateOne(
        { user_id: userId, provider },
        { $set: { is_connected: validation.valid, updated_at: new Date() } }
      );
    }

    return json({ success: true, connected: validation.valid, message: validation.message });
  } catch (e) { return json({ success: true, connected: false, message: e.message }); }
}

// ==================== DASHBOARD ====================
async function handleDashboardStats(userId) {
  const db = await getDb();
  const projects = await db.collection('projects').find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  const total = projects.length;
  const inProgress = projects.filter(p => !['scheduled', 'failed', 'submitted'].includes(p.status)).length;
  const completed = projects.filter(p => ['scheduled', 'youtube_uploaded'].includes(p.status)).length;
  const scheduled = projects.filter(p => p.status === 'scheduled').length;
  const failed = projects.filter(p => p.status === 'failed').length;
  return json({ success: true, stats: { total, in_progress: inProgress, completed, scheduled, failed }, recent_projects: projects.slice(0, 5) });
}

// ==================== YOUTUBE OAUTH ====================
async function handleYoutubeAuth(userId) {
  const integration = await integrationService.getUserIntegration(userId, 'youtube');
  const clientId = integration?.config_json?.client_id;
  if (!clientId) return error('YouTube not configured. Add Client ID in Integrations.', 'NOT_CONFIGURED');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/youtube/callback`;
  const authUrl = youtubeService.getAuthUrl(clientId, redirectUri);
  return json({ success: true, auth_url: authUrl });
}

async function handleYoutubeCallback(request, userId) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code) return error('Missing code', 'MISSING_CODE');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/?youtube_callback=success`);
  } catch (e) { return error(e.message, 'CALLBACK_ERROR', 500); }
}

// ==================== ROUTE HANDLER ====================
export async function GET(request, { params }) {
  const path = params?.path || [];
  if (path[0] === 'health') return json({ status: 'ok' });
  if (path[0] === 'youtube' && path[1] === 'callback') return handleYoutubeCallback(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return error('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;
  if (path[0] === 'projects' && path.length === 1) return handleGetProjects(userId);
  if (path[0] === 'projects' && path.length === 2) return handleGetProject(path[1], userId);
  if (path[0] === 'integrations') return handleGetIntegrations(userId);
  if (path[0] === 'dashboard' && path[1] === 'stats') return handleDashboardStats(userId);
  if (path[0] === 'youtube' && path[1] === 'auth') return handleYoutubeAuth(userId);
  if (path[0] === 'video-jobs' && path.length === 3 && path[2] === 'poll') return handlePollVideoJob(path[1], userId);
  return error('Not found', 'NOT_FOUND', 404);
}

export async function POST(request, { params }) {
  const path = params?.path || [];
  if (path[0] === 'register') return handleRegister(request);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return error('Unauthorized', 'UNAUTHORIZED', 401);
  const userId = session.user.id;
  if (path[0] === 'projects' && path.length === 1) return handleCreateProject(request, userId);
  if (path[0] === 'projects' && path.length === 3) {
    const id = path[1]; const action = path[2];
    if (action === 'evaluate') return handleEvaluateIdea(id, userId);
    if (action === 'generate-script') return handleGenerateScript(id, userId);
    if (action === 'generate-scenes') return handleGenerateScenes(id, userId);
    if (action === 'generate-video') return handleGenerateVideo(id, userId);
    if (action === 'generate-metadata') return handleGenerateMetadata(id, userId);
    if (action === 'publish-youtube') return handlePublishYoutube(id, userId);
    if (action === 'schedule-youtube') return handleScheduleYoutube(id, userId);
    if (action === 'run-pipeline') return handleRunPipeline(id, userId);
  }
  if (path[0] === 'integrations' && path[1] === 'test') return handleTestIntegration(request, userId);
  if (path[0] === 'integrations' && path.length === 1) return handleSaveIntegration(request, userId);
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
