import { getApiKey } from './integration.service';

const WORD_COUNT_MAP = { 30: { min: 60, max: 75 }, 60: { min: 120, max: 150 }, 180: { min: 360, max: 450 }, 480: { min: 960, max: 1200 } };

function getMockEvaluation(concept) {
  return {
    score: 8.5, feedback: `"${concept}" is a compelling concept with strong viral potential. The topic resonates with current trends and has a clear target audience. The hook potential is excellent.`,
    suggestions: ['Add a personal story or case study to increase relatability', 'Include surprising statistics to strengthen the hook', 'Consider a contrarian angle to stand out from competition'],
    market_potential: 'high', target_audience: 'Tech-savvy creators and entrepreneurs aged 18-35', competition_level: 'medium', is_mock: true
  };
}

function getMockScript(concept, duration) {
  const wc = WORD_COUNT_MAP[duration] || WORD_COUNT_MAP[60];
  const target = Math.floor((wc.min + wc.max) / 2);
  return {
    hook: `What if I told you that ${concept} could completely change the way you think about content creation? In the next ${duration} seconds, I'm going to show you exactly how.`,
    full_script: `What if I told you that ${concept} could completely change the way you think about content creation?\n\nLet's dive right in. The first thing you need to understand is that most people approach this completely wrong. They focus on quantity over quality, and that's exactly where the opportunity lies.\n\nHere's what the top 1% of creators do differently: they leverage systematic approaches that multiply their output while maintaining incredible quality. And the best part? You can start implementing this today.\n\nThink about it - every successful creator you follow has one thing in common: they've built systems. Not just workflows, but actual intelligent systems that handle the heavy lifting.\n\nNow here's where it gets really interesting. With the latest AI tools and automation, you can create a content pipeline that works around the clock.\n\nThe key is in the setup. You need three things: a clear content strategy, the right tools, and a feedback loop that continuously improves your output.`,
    cta: 'If you found this valuable, smash that like button and subscribe for more content creation strategies. Drop a comment below with your biggest takeaway!',
    word_count: target, is_mock: true
  };
}

function getMockScenes(duration, aspectRatio) {
  const n = Math.max(3, Math.floor(duration / 30));
  const sd = Math.floor(duration / n);
  const cs = aspectRatio === '9:16' ? 'fast_cuts' : aspectRatio === '1:1' ? 'static_focus' : 'smooth_pan';
  return {
    scenes: Array.from({ length: n }, (_, i) => ({
      scene_number: i + 1, duration_sec: i === n - 1 ? duration - sd * (n - 1) : sd,
      speaker_text: i === 0 ? 'Opening hook - grab attention immediately' : i === n - 1 ? 'Call to action - drive engagement' : `Key point ${i} - deliver core value`,
      visual_type: ['talking_head', 'b_roll', 'text_overlay', 'split_screen'][i % 4],
      background_prompt: i === 0 ? 'Modern studio with neon accent lighting' : `Dynamic ${i % 2 === 0 ? 'tech workspace' : 'abstract gradient'} background`,
      caption: i === 0 ? 'The Secret Nobody Tells You' : `Point ${i}: Key Insight`, camera_style: cs
    })), is_mock: true
  };
}

function getMockMetadata(concept) {
  return {
    title: `${concept} - The Complete Guide 2025`, alt_titles: [`How ${concept} Changed Everything`, `${concept}: What 99% Get Wrong`, `I Tried ${concept} For 30 Days`],
    description: `In this video, I break down everything about ${concept}.\n\nWhat you'll learn:\n- The fundamentals most people overlook\n- Advanced strategies from top creators\n- Step-by-step implementation guide\n\nTimestamps:\n0:00 - Introduction\n0:15 - The Problem\n0:45 - The Solution\n1:30 - Implementation\n2:30 - Results`,
    tags: [concept, 'content creation', 'youtube strategy', 'creator economy', '2025', 'tutorial'],
    hashtags: [`#${concept.replace(/\s+/g, '')}`, '#ContentCreation', '#YouTube', '#CreatorEconomy'],
    thumbnail_prompt: `Professional YouTube thumbnail: bold text "${concept}", vibrant gradient background, modern design, high contrast`, is_mock: true
  };
}

export async function evaluateIdea(concept, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) return getMockEvaluation(concept);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
        { role: 'system', content: 'You are a YouTube content strategist. Return JSON with: score (1-10 number), feedback (string), suggestions (array of 3 strings), market_potential (high/medium/low), target_audience (string), competition_level (high/medium/low).' },
        { role: 'user', content: `Evaluate this YouTube video concept: "${concept}"` }
      ], response_format: { type: 'json_object' }, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return { ...JSON.parse(data.choices[0].message.content), is_mock: false };
  } catch (e) { console.error('evaluateIdea:', e.message); return { ...getMockEvaluation(concept), error: e.message }; }
}

export async function generateScript(concept, duration, style, language, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) return getMockScript(concept, duration);
  const wc = WORD_COUNT_MAP[duration] || WORD_COUNT_MAP[60];
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
        { role: 'system', content: `You are a YouTube scriptwriter. Write in ${language || 'English'}, ${style || 'professional'} style. Return JSON: hook (string), full_script (string, ${wc.min}-${wc.max} words), cta (string), word_count (number).` },
        { role: 'user', content: `Write a ${duration}-second YouTube script about: "${concept}"` }
      ], response_format: { type: 'json_object' }, temperature: 0.8 })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return { ...JSON.parse(data.choices[0].message.content), is_mock: false };
  } catch (e) { console.error('generateScript:', e.message); return { ...getMockScript(concept, duration), error: e.message }; }
}

export async function generateScenes(script, duration, aspectRatio, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) return getMockScenes(duration, aspectRatio);
  const cam = aspectRatio === '9:16' ? 'fast cuts, vertical framing' : aspectRatio === '1:1' ? 'caption-heavy, static focus' : 'smooth panning, cinematic';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
        { role: 'system', content: `Video director. ${cam}. Return JSON with scenes array: scene_number, duration_sec, speaker_text, visual_type (talking_head/b_roll/text_overlay/split_screen), background_prompt, caption, camera_style. Total = ${duration}s.` },
        { role: 'user', content: `Break into scenes for ${aspectRatio} video:\n${script}` }
      ], response_format: { type: 'json_object' }, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return { ...JSON.parse(data.choices[0].message.content), is_mock: false };
  } catch (e) { console.error('generateScenes:', e.message); return { ...getMockScenes(duration, aspectRatio), error: e.message }; }
}

export async function generateMetadata(concept, script, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) return getMockMetadata(concept);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
        { role: 'system', content: 'YouTube SEO expert. Return JSON: title (under 60 chars), alt_titles (3 strings), description (full YouTube desc), tags (array), hashtags (array), thumbnail_prompt (string).' },
        { role: 'user', content: `Generate YouTube metadata:\nConcept: "${concept}"\nScript: "${(script || '').substring(0, 500)}"` }
      ], response_format: { type: 'json_object' }, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json();
    return { ...JSON.parse(data.choices[0].message.content), is_mock: false };
  } catch (e) { console.error('generateMetadata:', e.message); return { ...getMockMetadata(concept), error: e.message }; }
}
