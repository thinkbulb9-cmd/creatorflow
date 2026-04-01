/**
 * VALIDATION ENGINE
 * Production-grade pre-run validation system
 * Validates all prerequisites before pipeline execution
 */

export async function validateProjectReadiness(project, integrations, voices, avatars) {
  const validations = {
    integrations: {
      openai: false,
      heygen: false,
      youtube: false
    },
    config: {
      concept: false,
      language: false,
      duration: false,
      aspect_ratio: false,
      publishing_mode: false,
      voice: false,
      avatar: false
    },
    compatibility: {
      voice_avatar_gender: null,
      voice_language: null,
      voice_available: false,
      avatar_available: false
    },
    publishing: {
      valid: false,
      reason: null
    },
    warnings: [],
    errors: [],
    ready: false
  };

  // Validate Integrations
  const openaiInt = integrations.find(i => i.provider === 'openai' && i.is_connected);
  const heygenInt = integrations.find(i => i.provider === 'heygen' && i.is_connected);
  const youtubeInt = integrations.find(i => i.provider === 'youtube');

  validations.integrations.openai = !!openaiInt;
  validations.integrations.heygen = !!heygenInt;
  validations.integrations.youtube = youtubeInt?.config_json?.access_token ? true : false;

  if (!openaiInt) {
    validations.errors.push({
      category: 'integration',
      field: 'openai',
      message: 'OpenAI not connected. Required for script and metadata generation.',
      action: 'Go to Integrations → Connect OpenAI'
    });
  }

  if (!heygenInt) {
    validations.errors.push({
      category: 'integration',
      field: 'heygen',
      message: 'HeyGen not connected. Required for video generation.',
      action: 'Go to Integrations → Connect HeyGen'
    });
  }

  // Validate Project Config
  validations.config.concept = !!project.concept && project.concept.trim().length > 0;
  validations.config.language = !!project.language;
  validations.config.duration = project.duration_seconds > 0;
  validations.config.aspect_ratio = !!project.aspect_ratio;
  validations.config.publishing_mode = !!project.publishing_mode;

  if (!validations.config.concept) {
    validations.errors.push({
      category: 'config',
      field: 'concept',
      message: 'Video concept is required.',
      action: 'Enter a video concept'
    });
  }

  // Validate HeyGen Configuration
  if (heygenInt && project.selected_voice_id && project.selected_avatar_id && voices.length > 0 && avatars.length > 0) {
    const voice = voices.find(v => v.voice_id === project.selected_voice_id);
    const avatar = avatars.find(a => a.avatar_id === project.selected_avatar_id);

    if (voice) {
      validations.config.voice = true;
      validations.compatibility.voice_available = true;

      // Check language compatibility
      const voiceLangMatch = voice.language?.toLowerCase() === project.language?.toLowerCase();
      validations.compatibility.voice_language = voiceLangMatch;
      
      if (!voiceLangMatch) {
        validations.warnings.push({
          category: 'compatibility',
          field: 'voice_language',
          message: `Voice language (${voice.language}) doesn't match project language (${project.language}). Video generation may fail.`,
          severity: 'high'
        });
      }
    } else {
      validations.errors.push({
        category: 'heygen',
        field: 'voice',
        message: 'Selected voice not found or unavailable.',
        action: 'Select a different voice'
      });
    }

    if (avatar) {
      validations.config.avatar = true;
      validations.compatibility.avatar_available = true;
    } else {
      validations.errors.push({
        category: 'heygen',
        field: 'avatar',
        message: 'Selected avatar not found or unavailable.',
        action: 'Select a different avatar'
      });
    }

    // Gender compatibility check
    if (voice && avatar) {
      const voiceGender = voice.gender?.toLowerCase();
      const avatarGender = avatar.gender?.toLowerCase();
      
      if (voiceGender && avatarGender && voiceGender !== avatarGender) {
        validations.compatibility.voice_avatar_gender = false;
        validations.warnings.push({
          category: 'compatibility',
          field: 'gender',
          message: `Avatar gender (${avatar.gender}) doesn't match voice gender (${voice.gender}). This may affect video quality.`,
          severity: 'medium'
        });
      } else {
        validations.compatibility.voice_avatar_gender = true;
      }
    }
  } else if (heygenInt) {
    // Auto-select logic will be applied - assume valid
    validations.config.voice = true;
    validations.config.avatar = true;
  }

  // Validate Publishing Requirements
  const mode = project.publishing_mode;
  
  if (mode === 'scheduled') {
    if (!project.schedule_date || !project.schedule_time) {
      validations.publishing.valid = false;
      validations.publishing.reason = 'Schedule date and time required for Scheduled mode';
      validations.errors.push({
        category: 'publishing',
        field: 'schedule',
        message: 'Schedule date and time are required for Scheduled publishing mode.',
        action: 'Set schedule date and time'
      });
    } else {
      const scheduleDateTime = new Date(`${project.schedule_date}T${project.schedule_time}`);
      if (scheduleDateTime <= new Date()) {
        validations.publishing.valid = false;
        validations.publishing.reason = 'Schedule time must be in the future';
        validations.errors.push({
          category: 'publishing',
          field: 'schedule',
          message: 'Schedule time must be in the future.',
          action: 'Choose a future date and time'
        });
      } else if (!validations.integrations.youtube) {
        validations.publishing.valid = false;
        validations.publishing.reason = 'YouTube not connected (required for Scheduled mode)';
        validations.errors.push({
          category: 'publishing',
          field: 'youtube',
          message: 'YouTube must be connected for Scheduled publishing.',
          action: 'Go to Integrations → Connect YouTube'
        });
      } else {
        validations.publishing.valid = true;
      }
    }
  } else if (mode === 'instant') {
    if (!validations.integrations.youtube) {
      validations.publishing.valid = false;
      validations.publishing.reason = 'YouTube not connected (required for Instant Publish)';
      validations.errors.push({
        category: 'publishing',
        field: 'youtube',
        message: 'YouTube must be connected for Instant Publish mode.',
        action: 'Go to Integrations → Connect YouTube'
      });
    } else {
      validations.publishing.valid = true;
    }
  } else {
    // Draft mode - no publishing requirements
    validations.publishing.valid = true;
  }

  // Determine overall readiness
  validations.ready = validations.errors.length === 0 &&
                      validations.integrations.openai &&
                      validations.integrations.heygen &&
                      validations.config.concept &&
                      validations.publishing.valid;

  return validations;
}

export function getValidationSummary(validations) {
  const total = validations.errors.length + validations.warnings.length;
  const blocking = validations.errors.length;
  
  return {
    ready: validations.ready,
    blocking_issues: blocking,
    warnings: validations.warnings.length,
    total_issues: total,
    message: validations.ready 
      ? 'All systems ready' 
      : `${blocking} blocking issue${blocking !== 1 ? 's' : ''} must be resolved`
  };
}

// Helper to get available voices/avatars from integrations
export async function getHeyGenResources(heygenIntegration) {
  if (!heygenIntegration || !heygenIntegration.config_json?.api_key) {
    return { voices: [], avatars: [] };
  }
  
  try {
    // Import dynamically to avoid circular dependencies
    const heygenService = await import('./heygen.service.js');
    
    const voices = await heygenService.listVoices(heygenIntegration.config_json.api_key);
    const avatars = await heygenService.listAvatars(heygenIntegration.config_json.api_key);
    
    return { voices, avatars };
  } catch (error) {
    console.error('[Validation] Failed to fetch HeyGen resources:', error);
    return { voices: [], avatars: [] };
  }
}
