'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, PlayCircle,
  RefreshCw, Lightbulb, FileText, Film, Video, ImageIcon,
  Tag, Upload, Calendar, Clock, Copy, Check, ExternalLink,
  ChevronDown, ChevronUp, Zap, Star, TrendingUp, Target,
  Globe, Layers
} from 'lucide-react';
import { toast } from 'sonner';

// Pipeline steps — keys must match pipeline.service.js EXACTLY
const PIPELINE_STEPS = [
  { id: 'evaluate',  label: 'Evaluate',  icon: Lightbulb },
  { id: 'script',    label: 'Script',    icon: FileText   },
  { id: 'scenes',    label: 'Scenes',    icon: Film       },
  { id: 'video',     label: 'Video',     icon: Video      },
  { id: 'thumbnail', label: 'Thumb',     icon: ImageIcon  },
  { id: 'metadata',  label: 'Metadata',  icon: Tag        },
  { id: 'upload',    label: 'Upload',    icon: Upload     },
  { id: 'schedule',  label: 'Schedule',  icon: Calendar   },
];

function getStepStatus(pipelineState, stepId) {
  return pipelineState?.[stepId]?.status || 'pending';
}

function computeProgress(pipelineState) {
  if (!pipelineState) return 0;
  const completed = PIPELINE_STEPS.filter(s => pipelineState[s.id]?.status === 'completed').length;
  return Math.round((completed / PIPELINE_STEPS.length) * 100);
}

function StatusBadge({ status }) {
  const map = {
    draft:    'bg-slate-800 text-slate-300 border-slate-700',
    running:  'bg-blue-900/50 text-blue-300 border-blue-800 animate-pulse',
    failed:   'bg-red-900/50 text-red-300 border-red-800',
    published:'bg-green-900/50 text-green-300 border-green-800',
    scheduled:'bg-orange-900/50 text-orange-300 border-orange-800',
  };
  const cls = map[status] || map.draft;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft';
  return <Badge className={`${cls} border text-xs px-3 py-1`}>{label}</Badge>;
}

function StepStatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'running')   return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
  if (status === 'failed')    return <AlertCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-slate-600" />;
}

function Section({ title, icon: Icon, status, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasContent = status === 'completed';
  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => hasContent && setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${hasContent ? 'hover:bg-slate-800/30 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
            status === 'completed' ? 'bg-green-900/40 border border-green-800' :
            status === 'running'   ? 'bg-blue-900/40 border border-blue-800' :
            status === 'failed'    ? 'bg-red-900/40 border border-red-800' :
            'bg-slate-800 border border-slate-700'
          }`}>
            <Icon className={`h-4 w-4 ${
              status === 'completed' ? 'text-green-400' :
              status === 'running'   ? 'text-blue-400' :
              status === 'failed'    ? 'text-red-400' :
              'text-slate-500'
            }`} />
          </div>
          <span className="font-medium text-white text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <StepStatusIcon status={status} />
          {hasContent && (open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />)}
        </div>
      </button>
      {hasContent && open && (
        <div className="px-5 pb-5 border-t border-slate-800/60">
          {children}
        </div>
      )}
    </Card>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id: projectId } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(null);
  const pollRef = useRef(null);

  const fetchProject = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) { if (!silent) { setLoading(false); } return; }
      const data = await res.json();
      if (data.success && data.project) {
        setProject(data.project);
      }
    } catch (e) {
      if (!silent) toast.error('Failed to load project');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId]);

  // Polling while pipeline is running
  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    if (!project) return;
    const isRunning = project.pipeline_status === 'running' || project.status === 'running';
    if (isRunning && !pollRef.current) {
      pollRef.current = setInterval(() => fetchProject(true), 3000);
    } else if (!isRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [project, fetchProject]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleRunPipeline = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' })
      });
      const data = await res.json();
      if (data.success) {
        setProject(p => ({ ...p, ...data.project, pipeline_status: 'running', status: 'running' }));
        toast.success('Pipeline started! This may take a few minutes.');
      } else {
        toast.error(data.message || 'Failed to start pipeline');
      }
    } catch {
      toast.error('Network error starting pipeline');
    } finally {
      setRunning(false);
    }
  };

  const handleRerunStep = async (stepId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rerun_step', step: stepId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchProject(true);
        toast.success('Step regenerating...');
      } else {
        toast.error(data.message || 'Failed to rerun step');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleSelectThumbnail = async (idx) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_thumbnail_index: idx })
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.project);
        toast.success('Thumbnail selected');
      }
    } catch {
      toast.error('Failed to select thumbnail');
    }
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Project not found</h2>
          <Button onClick={() => router.push('/projects')} className="gap-2 bg-violet-600 hover:bg-violet-700">
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const pipelineState = project.pipeline_state || {};
  const progress = computeProgress(pipelineState);
  const isRunning = project.pipeline_status === 'running' || project.status === 'running';
  const isFailed  = project.pipeline_status === 'failed';
  const evalData  = project.idea_evaluation;
  const scriptData = project.script_data;
  const scenes   = project.scenes || [];
  const thumbData = project.thumbnail_data;
  const meta     = project.metadata;
  const completedSteps = PIPELINE_STEPS.filter(s => pipelineState[s.id]?.status === 'completed').length;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Link href="/projects" className="mt-1 p-1.5 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0">
              <ArrowLeft className="h-4 w-4 text-slate-400" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight truncate">{project.concept}</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {project.language} · {project.duration_seconds}s · {project.aspect_ratio} · {project.content_style}
              </p>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* ── Error Alert ── */}
        {(project.pipeline_error || isFailed) && (
          <Alert className="border-red-900/60 bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-300 text-sm ml-2">
              {project.pipeline_error || 'Pipeline failed. Click Re-run to try again.'}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Pipeline Progress Bar ── */}
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-white">Pipeline Progress</p>
                <p className="text-xs text-slate-500 mt-0.5">{completedSteps} of {PIPELINE_STEPS.length} steps complete</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-violet-400">{progress}%</p>
                {isRunning && <p className="text-xs text-blue-400 animate-pulse">Running...</p>}
              </div>
            </div>
            <Progress value={progress} className="h-1.5 bg-slate-800 mb-4" />
            {/* Step indicators */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const status = getStepStatus(pipelineState, step.id);
                return (
                  <div key={step.id} className="flex flex-col items-center flex-shrink-0 flex-1 min-w-0">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all mb-1.5 ${
                      status === 'completed' ? 'bg-green-900/40 border-green-600' :
                      status === 'running'   ? 'bg-blue-900/40 border-blue-500' :
                      status === 'failed'    ? 'bg-red-900/40 border-red-600' :
                      'bg-slate-800 border-slate-700'
                    }`}>
                      {status === 'running' ? (
                        <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                      ) : status === 'completed' ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : status === 'failed' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 text-slate-500" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 text-center leading-tight truncate w-full px-0.5">{step.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Run Pipeline CTA ── */}
        {!isRunning && (
          <div className="flex gap-3">
            <Button
              onClick={handleRunPipeline}
              disabled={running}
              className="flex-1 h-11 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-violet-900/30"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting Pipeline...</>
              ) : completedSteps === 0 ? (
                <><Zap className="h-4 w-4" /> Run Full Pipeline</>
              ) : isFailed ? (
                <><RefreshCw className="h-4 w-4" /> Re-run Pipeline</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Re-run from Start</>
              )}
            </Button>
          </div>
        )}
        {isRunning && (
          <div className="flex items-center justify-center gap-3 py-3 px-5 bg-blue-950/30 border border-blue-900/50 rounded-xl">
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
            <p className="text-blue-300 text-sm font-medium">Pipeline is running — results will appear below as each step completes</p>
          </div>
        )}

        {/* ── STEP SECTIONS ── */}

        {/* 1. Idea Evaluation */}
        <Section title="Idea Evaluation" icon={Lightbulb} status={getStepStatus(pipelineState, 'evaluate')} defaultOpen={!!evalData}>
          {evalData && (
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-4xl font-bold ${evalData.score >= 8 ? 'text-green-400' : evalData.score >= 6 ? 'text-orange-400' : 'text-red-400'}`}>
                      {evalData.score}
                    </span>
                    <span className="text-slate-500 text-lg">/10</span>
                    {evalData.score >= 7 && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Idea Quality Score</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('evaluate')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {evalData.opportunity_level && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Opportunity</p>
                    <p className="text-sm text-white font-medium capitalize">{evalData.opportunity_level}</p>
                  </div>
                )}
                {evalData.competition_level && (
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Target className="h-3 w-3" /> Competition</p>
                    <p className="text-sm text-white font-medium capitalize">{evalData.competition_level}</p>
                  </div>
                )}
              </div>
              {evalData.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</p>
                  <ul className="space-y-1">
                    {evalData.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {evalData.weaknesses?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2">Weaknesses</p>
                  <ul className="space-y-1">
                    {evalData.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-orange-500 mt-0.5 flex-shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {evalData.recommendations?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">Recommendations</p>
                  <ul className="space-y-1">
                    {evalData.recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-violet-400 mt-0.5 flex-shrink-0" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {evalData.suggested_topics?.length > 0 && evalData.score < 7 && (
                <div className="p-4 bg-violet-950/20 border border-violet-800/40 rounded-xl">
                  <p className="text-xs font-semibold text-violet-300 mb-2">💡 Stronger alternative ideas</p>
                  <ul className="space-y-1.5">
                    {evalData.suggested_topics.map((t, i) => (
                      <li key={i} className="text-sm text-slate-300">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 2. Script */}
        <Section title="Script" icon={FileText} status={getStepStatus(pipelineState, 'script')} defaultOpen={false}>
          {scriptData && (
            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {scriptData.word_count && (
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{scriptData.word_count} words</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('script')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              {scriptData.hook && (
                <div className="p-3.5 bg-yellow-950/20 border border-yellow-800/40 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5"><Star className="h-3 w-3" /> Hook</p>
                  <p className="text-sm text-slate-200 leading-relaxed">{scriptData.hook}</p>
                </div>
              )}
              {scriptData.full_script && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Full Script</p>
                    <button onClick={() => copy(scriptData.full_script, 'script')} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                      {copied === 'script' ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                    </button>
                  </div>
                  <div className="p-3.5 bg-slate-800/50 rounded-lg border border-slate-700 max-h-64 overflow-y-auto">
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{scriptData.full_script}</p>
                  </div>
                </div>
              )}
              {scriptData.cta && (
                <div className="p-3.5 bg-green-950/20 border border-green-800/40 rounded-lg">
                  <p className="text-xs font-semibold text-green-400 mb-2">Call to Action</p>
                  <p className="text-sm text-slate-200">{scriptData.cta}</p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 3. Scenes */}
        <Section title="Scenes" icon={Film} status={getStepStatus(pipelineState, 'scenes')} defaultOpen={false}>
          {scenes.length > 0 && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">{scenes.length} scenes generated</p>
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('scenes')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              {scenes.map((scene, idx) => (
                <div key={idx} className="p-3.5 bg-slate-800/40 rounded-lg border border-slate-700/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-violet-400">Scene {scene.scene_number || idx + 1}</span>
                    {scene.duration_sec && <span className="text-xs text-slate-500">{scene.duration_sec}s</span>}
                  </div>
                  {scene.speaker_text && <p className="text-sm text-slate-200 mb-2 leading-relaxed">&ldquo;{scene.speaker_text}&rdquo;</p>}
                  {scene.visual_direction && <p className="text-xs text-slate-500 italic">{scene.visual_direction}</p>}
                  {(scene.camera_style || scene.transition) && (
                    <div className="flex gap-2 mt-2">
                      {scene.camera_style && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{scene.camera_style}</span>}
                      {scene.transition && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">→ {scene.transition}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 4. Video */}
        <Section title="Video Generation" icon={Video} status={getStepStatus(pipelineState, 'video')} defaultOpen={false}>
          {project.video_url && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Video ready</p>
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('video')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
                <video src={project.video_url} controls className="w-full max-h-72" />
              </div>
              <a href={project.video_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300">
                <ExternalLink className="h-3 w-3" /> Open video URL
              </a>
            </div>
          )}
          {!project.video_url && getStepStatus(pipelineState, 'video') === 'completed' && (
            <div className="pt-4">
              <p className="text-sm text-slate-400">Video processed. URL not yet available.</p>
            </div>
          )}
        </Section>

        {/* 5. Thumbnail */}
        <Section title="Thumbnails" icon={ImageIcon} status={getStepStatus(pipelineState, 'thumbnail')} defaultOpen={false}>
          {thumbData && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {thumbData.selected_index != null ? '✓ Thumbnail selected' : 'Click to select a thumbnail'}
                </p>
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('thumbnail')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              {thumbData.thumbnails?.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {thumbData.thumbnails.map((url, idx) => (
                    <button key={idx} type="button" onClick={() => handleSelectThumbnail(idx)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        thumbData.selected_index === idx
                          ? 'border-violet-500 ring-2 ring-violet-500/30'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}>
                      <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full aspect-video object-cover" />
                      {thumbData.selected_index === idx && (
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-violet-600 flex items-center justify-center shadow">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : thumbData.prompt ? (
                <div className="p-3.5 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-500 mb-1">Thumbnail Prompt</p>
                  <p className="text-sm text-slate-200">{thumbData.prompt}</p>
                </div>
              ) : null}
            </div>
          )}
        </Section>

        {/* 6. Metadata */}
        <Section title="Metadata" icon={Tag} status={getStepStatus(pipelineState, 'metadata')} defaultOpen={false}>
          {meta && (
            <div className="pt-4 space-y-4">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => handleRerunStep('metadata')} className="text-slate-500 hover:text-white border border-slate-700 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                </Button>
              </div>
              {meta.title && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Title</p>
                  <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-white flex-1">{meta.title}</p>
                    <button onClick={() => copy(meta.title, 'title')} className="text-slate-500 hover:text-white flex-shrink-0 mt-0.5">
                      {copied === 'title' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {meta.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Description</p>
                  <div className="relative p-3 bg-slate-800/50 rounded-lg border border-slate-700 max-h-36 overflow-y-auto">
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap pr-6">{meta.description}</p>
                    <button onClick={() => copy(meta.description, 'desc')} className="absolute top-2 right-2 text-slate-500 hover:text-white">
                      {copied === 'desc' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              {meta.tags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-1 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {meta.hashtags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.hashtags.map((h, i) => (
                      <span key={i} className="text-xs bg-violet-950/40 border border-violet-800/40 text-violet-300 px-2 py-1 rounded">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 7. Upload */}
        <Section title="YouTube Upload" icon={Upload} status={getStepStatus(pipelineState, 'upload')} defaultOpen={false}>
          {project.youtube_video_id && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-3 p-3.5 bg-green-950/20 border border-green-800/40 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">Uploaded to YouTube</p>
                  <p className="text-xs text-slate-500">ID: {project.youtube_video_id}</p>
                </div>
              </div>
              {project.youtube_url && (
                <a href={project.youtube_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 font-medium">
                  <ExternalLink className="h-4 w-4" /> View on YouTube
                </a>
              )}
            </div>
          )}
          {!project.youtube_video_id && getStepStatus(pipelineState, 'upload') === 'completed' && (
            <div className="pt-4">
              <p className="text-sm text-slate-400">Upload step completed.</p>
            </div>
          )}
        </Section>

        {/* 8. Schedule */}
        <Section title="Schedule / Publish" icon={Calendar} status={getStepStatus(pipelineState, 'schedule')} defaultOpen={false}>
          {getStepStatus(pipelineState, 'schedule') === 'completed' && (
            <div className="pt-4 space-y-3">
              <div className="flex items-center gap-3 p-3.5 bg-green-950/20 border border-green-800/40 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {project.publishing_mode === 'scheduled' ? 'Video scheduled' : 'Video published'}
                  </p>
                  {project.publish_at && (
                    <p className="text-xs text-slate-500">
                      Scheduled for {new Date(project.publish_at).toLocaleString()}
                    </p>
                  )}
                  {project.published_at && (
                    <p className="text-xs text-slate-500">
                      Published at {new Date(project.published_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Project Settings summary ── */}
        <Card className="border-slate-800 bg-slate-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Project Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { label: 'Language', value: project.language, icon: Globe },
                { label: 'Duration', value: `${project.duration_seconds}s`, icon: Clock },
                { label: 'Aspect Ratio', value: project.aspect_ratio, icon: Layers },
                { label: 'Style', value: project.content_style, icon: Star },
                { label: 'Publishing', value: project.publishing_mode, icon: Upload },
                project.schedule_date && { label: 'Scheduled', value: `${project.schedule_date} ${project.schedule_time || ''}`.trim(), icon: Calendar },
              ].filter(Boolean).map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-600">{label}</p>
                    <p className="text-xs text-slate-300 font-medium capitalize">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
