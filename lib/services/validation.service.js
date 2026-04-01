// HeyGen Avatar and Voice Validation Service

export function validateAvatarVoiceMatch(avatar, voice) {
  const warnings = [];
  const errors = [];
  
  // Gender matching validation
  if (avatar?.gender && voice?.gender) {
    const avatarGender = avatar.gender.toLowerCase();
    const voiceGender = voice.gender.toLowerCase();
    
    if (avatarGender !== voiceGender && avatarGender !== 'unknown' && voiceGender !== 'unknown') {
      warnings.push({
        type: 'gender_mismatch',
        message: `Avatar gender (${avatar.gender}) doesn't match voice gender (${voice.gender}). This may affect video quality.`,
        severity: 'warning'
      });
    }
  }
  
  // Language compatibility validation
  if (voice?.language && avatar?.supported_languages) {
    const voiceLang = voice.language.toLowerCase().split('-')[0]; // Get base language (e.g., 'en' from 'en-US')
    const avatarLangs = avatar.supported_languages.map(l => l.toLowerCase());
    
    if (!avatarLangs.includes(voiceLang) && avatarLangs.length > 0) {
      warnings.push({
        type: 'language_mismatch',
        message: `Voice language (${voice.language}) may not be supported by this avatar.`,
        severity: 'warning'
      });
    }
  }
  
  // Avatar availability check
  if (avatar && avatar.status === 'inactive') {
    errors.push({
      type: 'avatar_unavailable',
      message: `Selected avatar "${avatar.avatar_name}" is currently unavailable.`,
      severity: 'error'
    });
  }
  
  // Voice availability check
  if (voice && voice.status === 'inactive') {
    errors.push({
      type: 'voice_unavailable',
      message: `Selected voice "${voice.voice_name}" is currently unavailable.`,
      severity: 'error'
    });
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
    can_proceed: errors.length === 0, // Can proceed with warnings, but not with errors
    recommendation: errors.length > 0 
      ? 'Please fix the errors before proceeding with video generation.'
      : warnings.length > 0
        ? 'Consider reviewing the warnings for better video quality.'
        : 'Avatar and voice combination looks good!'
  };
}

export function getGenderFromVoiceName(voiceName) {
  // Attempt to infer gender from voice name
  const nameLower = voiceName.toLowerCase();
  
  // Common female voice names
  const femaleNames = ['jenny', 'sara', 'emma', 'olivia', 'nancy', 'monica', 'aria', 'jane', 'alice', 'maria'];
  // Common male voice names
  const maleNames = ['guy', 'tony', 'ryan', 'jason', 'brian', 'davis', 'eric', 'james', 'john', 'michael'];
  
  for (const name of femaleNames) {
    if (nameLower.includes(name)) return 'female';
  }
  
  for (const name of maleNames) {
    if (nameLower.includes(name)) return 'male';
  }
  
  return 'unknown';
}

export function suggestBetterVoice(avatar, availableVoices) {
  if (!avatar || !availableVoices || availableVoices.length === 0) {
    return null;
  }
  
  // Filter voices that match avatar gender
  const matchingVoices = availableVoices.filter(voice => {
    if (!voice.gender || !avatar.gender) return false;
    return voice.gender.toLowerCase() === avatar.gender.toLowerCase();
  });
  
  if (matchingVoices.length > 0) {
    return {
      recommended: matchingVoices[0],
      reason: `This voice matches your avatar's gender (${avatar.gender}).`,
      all_matching: matchingVoices
    };
  }
  
  return null;
}

export function suggestBetterAvatar(voice, availableAvatars) {
  if (!voice || !availableAvatars || availableAvatars.length === 0) {
    return null;
  }
  
  // Filter avatars that match voice gender
  const matchingAvatars = availableAvatars.filter(avatar => {
    if (!avatar.gender || !voice.gender) return false;
    return avatar.gender.toLowerCase() === voice.gender.toLowerCase();
  });
  
  if (matchingAvatars.length > 0) {
    return {
      recommended: matchingAvatars[0],
      reason: `This avatar matches your voice's gender (${voice.gender}).`,
      all_matching: matchingAvatars
    };
  }
  
  return null;
}

export function validateSceneConfiguration(scenes, duration, aspectRatio) {
  const warnings = [];
  const errors = [];
  
  if (!scenes || scenes.length === 0) {
    errors.push({
      type: 'no_scenes',
      message: 'No scenes provided',
      severity: 'error'
    });
    return { valid: false, warnings, errors };
  }
  
  // Calculate total duration
  const totalDuration = scenes.reduce((sum, scene) => sum + (scene.duration_sec || 0), 0);
  
  // Duration validation (allow 10% tolerance)
  const tolerance = duration * 0.1;
  if (Math.abs(totalDuration - duration) > tolerance) {
    warnings.push({
      type: 'duration_mismatch',
      message: `Total scene duration (${totalDuration}s) doesn't match requested duration (${duration}s). Difference: ${Math.abs(totalDuration - duration).toFixed(1)}s`,
      severity: 'warning'
    });
  }
  
  // Aspect ratio pacing validation
  const avgSceneDuration = totalDuration / scenes.length;
  
  if (aspectRatio === '9:16') {
    // Vertical video should have faster pacing
    if (avgSceneDuration > 5) {
      warnings.push({
        type: 'slow_pacing',
        message: `Scenes average ${avgSceneDuration.toFixed(1)}s each. Vertical videos (9:16) work better with faster cuts (2-4s per scene).`,
        severity: 'info'
      });
    }
  } else if (aspectRatio === '16:9') {
    // Horizontal video can have slower pacing
    if (avgSceneDuration < 3) {
      warnings.push({
        type: 'fast_pacing',
        message: `Scenes average ${avgSceneDuration.toFixed(1)}s each. Horizontal videos (16:9) can use slightly longer scenes (4-8s) for better storytelling.`,
        severity: 'info'
      });
    }
  }
  
  // Check for missing required fields
  scenes.forEach((scene, index) => {
    if (!scene.speaker_text || scene.speaker_text.trim().length === 0) {
      errors.push({
        type: 'missing_speaker_text',
        message: `Scene ${index + 1} is missing speaker text`,
        severity: 'error'
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    warnings,
    errors,
    total_duration: totalDuration,
    average_scene_duration: avgSceneDuration,
    scene_count: scenes.length
  };
}
