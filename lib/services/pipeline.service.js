// Pipeline state management utilities

export const PIPELINE_STEPS = [
  { key: 'evaluate', name: 'Idea Evaluation', order: 1 },
  { key: 'script', name: 'Script Generation', order: 2 },
  { key: 'scenes', name: 'Scene Creation', order: 3 },
  { key: 'video', name: 'Video Generation', order: 4 },
  { key: 'thumbnail', name: 'Thumbnail Generation', order: 5 },
  { key: 'metadata', name: 'Metadata Generation', order: 6 },
  { key: 'upload', name: 'YouTube Upload', order: 7 },
  { key: 'schedule', name: 'Schedule Post', order: 8 }
];

export function initializePipelineState() {
  const state = {};
  PIPELINE_STEPS.forEach(step => {
    state[step.key] = {
      status: 'pending', // pending | running | completed | failed
      started_at: null,
      completed_at: null,
      error: null
    };
  });
  return state;
}

export function canRunStep(stepKey, pipelineState) {
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === stepKey);
  if (stepIndex === 0) return true; // First step can always run
  
  // Check if all previous steps are completed
  for (let i = 0; i < stepIndex; i++) {
    const prevStep = PIPELINE_STEPS[i];
    if (pipelineState[prevStep.key]?.status !== 'completed') {
      return false;
    }
  }
  
  return true;
}

export function getNextPendingStep(pipelineState) {
  for (const step of PIPELINE_STEPS) {
    const stepState = pipelineState[step.key];
    if (!stepState || stepState.status === 'pending' || stepState.status === 'failed') {
      return step.key;
    }
  }
  return null;
}

export function calculateProgress(pipelineState) {
  const completedSteps = PIPELINE_STEPS.filter(
    step => pipelineState[step.key]?.status === 'completed'
  ).length;
  
  const totalSteps = PIPELINE_STEPS.length;
  const percentage = Math.round((completedSteps / totalSteps) * 100);
  
  return {
    completed: completedSteps,
    total: totalSteps,
    percentage,
    label: `${completedSteps} of ${totalSteps} steps completed`
  };
}

export function getCurrentStepInfo(pipelineState) {
  // Find the first non-completed step
  const currentStep = PIPELINE_STEPS.find(step => {
    const state = pipelineState[step.key];
    return !state || state.status !== 'completed';
  });
  
  if (!currentStep) {
    return { key: null, name: 'All steps completed', status: 'completed' };
  }
  
  const state = pipelineState[currentStep.key];
  return {
    key: currentStep.key,
    name: currentStep.name,
    status: state?.status || 'pending'
  };
}

export function markStepRunning(pipelineState, stepKey) {
  return {
    ...pipelineState,
    [stepKey]: {
      ...pipelineState[stepKey],
      status: 'running',
      started_at: new Date().toISOString(),
      error: null
    }
  };
}

export function markStepCompleted(pipelineState, stepKey) {
  return {
    ...pipelineState,
    [stepKey]: {
      ...pipelineState[stepKey],
      status: 'completed',
      completed_at: new Date().toISOString(),
      error: null
    }
  };
}

export function markStepFailed(pipelineState, stepKey, error) {
  return {
    ...pipelineState,
    [stepKey]: {
      ...pipelineState[stepKey],
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: error || 'Unknown error'
    }
  };
}

export function shouldCacheResult(project, stepKey) {
  // Check if this step already has cached data
  switch (stepKey) {
    case 'evaluate':
      return !!project.idea_evaluation;
    case 'script':
      return !!project.script_data;
    case 'scenes':
      return !!(project.scenes && project.scenes.length > 0);
    case 'video':
      return !!(project.video_url && project.video_job_id);
    case 'thumbnail':
      return !!(project.thumbnail_data && project.thumbnail_data.selected);
    case 'metadata':
      return !!project.metadata;
    case 'upload':
      return !!project.youtube_id;
    case 'schedule':
      return !!project.schedule_at;
    default:
      return false;
  }
}
