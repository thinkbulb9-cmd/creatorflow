import { getApiKey } from './integration.service';

const WORD_COUNT_MAP = { 30: { min: 60, max: 75 }, 60: { min: 120, max: 150 }, 180: { min: 360, max: 450 }, 480: { min: 960, max: 1200 } };

export async function evaluateIdea(concept, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
      { role: 'system', content: 'You are a YouTube content strategist. Return JSON with: score (1-10 number), feedback (string), suggestions (array of 3 strings), market_potential (high/medium/low), target_audience (string), competition_level (high/medium/low).' },
      { role: 'user', content: `Evaluate this YouTube video concept: "${concept}"` }
    ], response_format: { type: 'json_object' }, temperature: 0.7 })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI API error: ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateScript(concept, duration, style, language, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  const wc = WORD_COUNT_MAP[duration] || WORD_COUNT_MAP[60];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
      { role: 'system', content: `You are a professional YouTube scriptwriter. Write in ${language || 'English'} with a ${style || 'professional'} style. Return JSON with: hook (string, opening 2-3 sentences), full_script (string, complete script between ${wc.min}-${wc.max} words), cta (string, call to action), word_count (number, actual word count of full_script).` },
      { role: 'user', content: `Write a ${duration}-second YouTube script about: "${concept}"` }
    ], response_format: { type: 'json_object' }, temperature: 0.8 })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI API error: ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateScenes(script, duration, aspectRatio, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  const cam = aspectRatio === '9:16' ? 'fast cuts, vertical framing' : aspectRatio === '1:1' ? 'caption-heavy, static focus' : 'smooth panning, cinematic';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
      { role: 'system', content: `You are a professional video director. Use ${cam} style. Return JSON with a "scenes" array where each scene has: scene_number (number), duration_sec (number), speaker_text (string, what the speaker says), visual_type (one of: "talking_head", "b_roll", "text_overlay", "split_screen"), background_prompt (string, description for AI background generation), caption (string, short caption text), camera_style (string). The total duration of all scenes must equal exactly ${duration} seconds.` },
      { role: 'user', content: `Break this script into scenes for a ${aspectRatio} video (${duration} seconds total):\n\n${script}` }
    ], response_format: { type: 'json_object' }, temperature: 0.7 })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI API error: ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateMetadata(concept, script, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
      { role: 'system', content: 'You are a YouTube SEO expert. Generate optimized metadata. Return JSON with: title (string, under 60 characters, engaging), alt_titles (array of 3 alternative title strings), description (string, full YouTube description with sections and timestamps), tags (array of relevant tag strings), hashtags (array of hashtag strings with # prefix), thumbnail_prompt (string, detailed AI image generation prompt for the thumbnail).' },
      { role: 'user', content: `Generate YouTube metadata for:\nConcept: "${concept}"\nScript excerpt: "${(script || '').substring(0, 500)}"` }
    ], response_format: { type: 'json_object' }, temperature: 0.7 })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI API error: ${res.status}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
