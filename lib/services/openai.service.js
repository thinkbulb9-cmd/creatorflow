import { getApiKey } from './integration.service';

const WORD_COUNT_MAP = { 
  30: { min: 60, max: 75 }, 
  60: { min: 120, max: 150 }, 
  180: { min: 360, max: 450 }, 
  480: { min: 960, max: 1200 } 
};

export async function evaluateIdea(concept, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: 'gpt-4o-mini', 
      messages: [
        { 
          role: 'system', 
          content: `You are a YouTube content strategist with deep platform expertise. Evaluate video concepts realistically and critically.

Return JSON with:
- score: number 1-10 (be realistic, most concepts are 4-7)
- opportunity_level: "high" | "medium" | "low"
- competition_level: "high" | "medium" | "low"
- audience_fit: string (who this resonates with)
- strengths: array of 2-3 specific strength strings
- weaknesses: array of 2-3 specific weakness strings
- recommendations: array of 3 objects with {text: string, why: string, impact: string}
- virality_potential: "high" | "medium" | "low"
- monetization_fit: "excellent" | "good" | "fair" | "poor"
- hook_quality: "strong" | "moderate" | "weak"
- format_suitability: "excellent" | "good" | "needs_work"

Scoring guidelines:
1-3: Poor concept, major issues
4-5: Needs significant improvement
6-7: Solid concept with room for growth (most ideas)
8-9: Excellent, well-defined concept
10: Exceptional, viral-ready concept (rare)` 
        },
        { role: 'user', content: `Evaluate this YouTube video concept critically and realistically: "${concept}"` }
      ], 
      response_format: { type: 'json_object' }, 
      temperature: 0.7 
    })
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
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: 'gpt-4o-mini', 
      messages: [
        { 
          role: 'system', 
          content: `You are a professional YouTube scriptwriter. Write in ${language || 'English'} with a ${style || 'professional'} style. 
          
Return JSON with:
- hook: string (opening 2-3 sentences)
- full_script: string (complete script between ${wc.min}-${wc.max} words)
- cta: string (call to action)
- word_count: number (actual word count of full_script)
- key_points: array of main points covered` 
        },
        { role: 'user', content: `Write a ${duration}-second YouTube script about: "${concept}"` }
      ], 
      response_format: { type: 'json_object' }, 
      temperature: 0.8 
    })
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
  
  const cam = aspectRatio === '9:16' 
    ? 'fast cuts, vertical framing' 
    : aspectRatio === '1:1' 
      ? 'caption-heavy, static focus' 
      : 'smooth panning, cinematic';
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: 'gpt-4o-mini', 
      messages: [
        { 
          role: 'system', 
          content: `You are a professional video director. Use ${cam} style. 
          
Return JSON with a "scenes" array where each scene has:
- scene_number: number
- duration_sec: number
- speaker_text: string (what the speaker says)
- visual_type: "talking_head" | "b_roll" | "text_overlay" | "split_screen"
- background_prompt: string (description for AI background generation)
- caption: string (short caption text)
- camera_style: string

The total duration of all scenes must equal exactly ${duration} seconds.` 
        },
        { role: 'user', content: `Break this script into scenes for a ${aspectRatio} video (${duration} seconds total):\n\n${script}` }
      ], 
      response_format: { type: 'json_object' }, 
      temperature: 0.7 
    })
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
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: 'gpt-4o-mini', 
      messages: [
        { 
          role: 'system', 
          content: `You are a YouTube SEO expert. Generate optimized metadata. 
          
Return JSON with:
- title: string (under 60 characters, engaging)
- alt_titles: array of 3 alternative title strings
- description: string (full YouTube description with sections and timestamps)
- tags: array of relevant tag strings
- hashtags: array of hashtag strings with # prefix
- thumbnail_prompt: string (detailed AI image generation prompt for the thumbnail)` 
        },
        { role: 'user', content: `Generate YouTube metadata for:\nConcept: "${concept}"\nScript excerpt: "${(script || '').substring(0, 500)}"` }
      ], 
      response_format: { type: 'json_object' }, 
      temperature: 0.7 
    })
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `OpenAI API error: ${res.status}`);
  }
  
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateThumbnail(thumbnailPrompt, aspectRatios, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  
  const results = {};
  
  // Generate thumbnail for each aspect ratio
  for (const ratio of aspectRatios) {
    const size = ratio === '16:9' ? '1792x1024' : ratio === '9:16' ? '1024x1792' : '1024x1024';
    
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `YouTube thumbnail: ${thumbnailPrompt}. High quality, eye-catching, professional design with bold text and vibrant colors.`,
        n: 1,
        size: size,
        quality: 'standard'
      })
    });
    
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || `OpenAI Image API error: ${res.status}`);
    }
    
    const data = await res.json();
    results[ratio] = data.data[0].url;
  }
  
  return results;
}
