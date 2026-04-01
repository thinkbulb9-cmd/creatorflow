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
          content: `You are a YouTube content strategist with deep platform expertise and access to real-time trending topics. Evaluate video concepts realistically based on actual platform performance data and current trends.

CRITICAL: When scoring, consider:
1. Current trending topics in the niche (2026 trends)
2. Real search volume and interest
3. Actual competition levels
4. Recent viral video patterns
5. Emerging trends and seasonality

Scoring Philosophy:
- Score based on ACTUAL trending data, not random
- Concepts aligned with current trends: score 7-9
- Generic or oversaturated topics: score 3-5  
- Outdated or declining interest: score 1-3
- Breakthrough/emerging trends: score 9-10

Return JSON with:
{
  "score": number 1-10 (based on REAL trending data),
  "trend_analysis": "1-2 sentences on how this aligns with current 2026 trends",
  "opportunity_level": "high" | "medium" | "low",
  "competition_level": "high" | "medium" | "low",
  "audience_fit": "string describing who this resonates with and why",
  "strengths": ["2-3 specific, actionable strength points"],
  "weaknesses": ["2-3 specific concerns or gaps"],
  "recommendations": [
    {
      "text": "specific improvement recommendation",
      "why": "explanation of why this matters",
      "impact": "expected improvement if implemented"
    }
  ],
  "suggested_topics": ["3-5 TRENDING alternative topics that would score 8+ based on current demand", "MUST be relevant to 2026 trends", "only if score < 8"],
  "virality_potential": "high" | "medium" | "low",
  "monetization_fit": "excellent" | "good" | "fair" | "poor",
  "hook_quality": "strong" | "moderate" | "weak",
  "format_suitability": "excellent" | "good" | "needs_work",
  "competitive_edge": "what makes this stand out or what's missing"
}

IMPORTANT: Use your knowledge of 2026 trends. If a suggested topic is picked and re-evaluated, it MUST score higher (7-9) because it's based on trending data.` 
        },
        { role: 'user', content: `Evaluate this YouTube video concept considering current 2026 trending topics and search demand: "${concept}"

Consider: Is this topic trending? What's the search volume? What are people actually searching for right now? Be data-driven, not random.` }
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
          content: `You are a professional YouTube scriptwriter specializing in ${style} content for ${language} audiences.

Script Structure Requirements:
1. HOOK (first 3-5 seconds): Immediately grab attention with curiosity, bold statement, or question
2. CONTEXT (next 5-10 seconds): Establish credibility and preview value
3. VALUE DELIVERY (main body): Deliver on the promise with clear, engaging points
4. CALL TO ACTION (final 5-10 seconds): Strong, specific CTA

Writing Guidelines:
- Write in ${language} language
- Tone: ${style}
- Target word count: ${wc.min}-${wc.max} words
- Use conversational, natural language
- Avoid generic phrases like "in this video" or "today we'll discuss"
- Start strong - no weak intros
- Use specific examples and concrete details
- Maintain energy throughout
- End with clear, actionable CTA

Return JSON:
{
  "hook": "powerful opening 1-2 sentences (must grab attention immediately)",
  "full_script": "complete ${wc.min}-${wc.max} word script following the structure",
  "cta": "specific call to action (not generic)",
  "word_count": actual_word_count,
  "key_points": ["3-5 main points covered"],
  "script_notes": "brief notes on pacing, emphasis, or delivery suggestions"
}

Make it compelling. Make it specific. Make it work.` 
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
  
  const visualStyle = aspectRatio === '9:16' 
    ? 'vertical mobile-first framing, close-ups, dynamic cuts every 2-3 seconds' 
    : aspectRatio === '1:1' 
      ? 'square social format, centered composition, text-friendly space' 
      : 'cinematic horizontal framing, professional pacing, smooth transitions';
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ 
      model: 'gpt-4o-mini', 
      messages: [
        { 
          role: 'system', 
          content: `You are a professional video director breaking down scripts into production-ready scenes.

Visual Style: ${visualStyle}
Aspect Ratio: ${aspectRatio}
Total Duration: ${duration} seconds

Scene Requirements:
Each scene must have:
- scene_number: sequential number
- duration_sec: precise duration (total must equal ${duration}s exactly)
- speaker_text: what the speaker says (from script)
- visual_direction: specific visual setup and framing guidance
- camera_style: camera movement/angle (e.g., "medium close-up, static", "slow zoom in", "over-shoulder")
- caption: concise on-screen caption text
- on_screen_text: any text overlay suggestions (keep minimal)
- transition: how this scene transitions to next ("cut", "fade", "zoom", "slide")
- b_roll_suggestion: specific b-roll footage recommendation to overlay or intercut
- music_mood: recommended music mood for this scene

Music Mood Options:
- motivational: upbeat, inspiring
- cinematic: dramatic, emotional
- professional: clean, corporate
- calm: soft, peaceful
- energetic: fast-paced, exciting
- suspenseful: building tension
- playful: fun, lighthearted

B-roll Guidelines:
- Suggest specific, relevant footage
- Keep suggestions actionable
- Match the narrative purpose

Pacing Logic:
- Hook scenes: fast cuts, 2-3 seconds each
- Value delivery: 5-8 seconds per point
- CTA: 5-10 seconds, hold on speaker

Return JSON:
{
  "scenes": [array of scene objects with ALL fields above],
  "total_duration": must equal ${duration},
  "scene_count": number of scenes,
  "pacing_notes": "brief notes on flow and timing"
}

Be specific. Be cinematic. Make it production-ready.` 
        },
        { role: 'user', content: `Break this script into ${aspectRatio} scenes (${duration}s total):\n\n${script}` }
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
          content: `You are a YouTube SEO expert optimizing metadata for maximum discoverability and CTR.

Title Requirements:
- Under 60 characters (YouTube displays ~50 on mobile)
- Front-load primary keyword
- Include curiosity gap or benefit
- Use power words (proven, secret, ultimate, etc.)
- Avoid clickbait - be compelling but honest

Description Requirements:
- First 150 characters are critical (shown before "show more")
- Include primary and secondary keywords naturally
- Add timestamps for longer videos
- Include relevant links (optional placeholders)
- Clear structure with sections

Tags:
- 10-15 highly relevant tags
- Mix of broad and specific terms
- Include variations and related terms

Thumbnail Prompt:
- This is CRITICAL for premium thumbnail generation
- Be ultra-specific about composition, colors, emotion
- Design for small screen visibility
- Focus on contrast, faces, text readability
- Platform-optimized for YouTube CTR

Return JSON:
{
  "title": "SEO-optimized title under 60 chars",
  "alt_titles": ["3 alternative title options"],
  "description": "full YouTube description with structure and timestamps",
  "tags": ["array of 10-15 relevant tags"],
  "hashtags": ["array of 3-5 hashtags with # prefix"],
  "thumbnail_prompt": "DETAILED premium thumbnail image generation prompt with specific composition, colors, emotion, text placement guidance. Make this creative and strategic for high CTR."
}` 
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

export async function generateThumbnailConcept(concept, metadata, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  
  const basePrompt = metadata?.thumbnail_prompt || `YouTube thumbnail for: ${concept}`;
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a YouTube thumbnail strategist specializing in high-CTR, attention-grabbing designs.

Thumbnail Strategy Framework:
1. EMOTIONAL HOOK: What emotion drives the click? (curiosity, excitement, fear, desire)
2. VISUAL HIERARCHY: What's the first thing viewers see? (face, text, object)
3. CONTRAST: High contrast colors for thumb-stopping power
4. SIMPLICITY: Clear focal point, not cluttered
5. TEXT: Large, bold, readable on mobile (3-5 words max)
6. COMPOSITION: Rule of thirds, leading lines, depth
7. PLATFORM CONTEXT: YouTube browse/search context

Creative Angles:
- Before/After split
- Shocked/excited face reaction
- Bold contrasting text overlay
- Mystery/reveal tease
- Authority/expertise signal
- Problem → Solution visual
- Comparison/vs format

Return JSON:
{
  "creative_angle": "which thumbnail strategy is being used and why",
  "emotion_target": "primary emotion this thumbnail triggers",
  "focal_point": "what viewers see first",
  "color_strategy": "color palette and contrast approach",
  "text_overlay": "exact text to display on thumbnail (3-5 words)",
  "composition_notes": "layout and visual hierarchy guidance",
  "image_prompt_16_9": "ULTRA-DETAILED DALL-E prompt for 16:9 landscape thumbnail",
  "image_prompt_9_16": "ULTRA-DETAILED DALL-E prompt for 9:16 vertical thumbnail", 
  "image_prompt_1_1": "ULTRA-DETAILED DALL-E prompt for 1:1 square thumbnail"
}

Make prompts hyper-specific: include exact colors, expressions, positioning, lighting, style (photorealistic, illustrated, 3D, etc.), text placement zones.`
        },
        { role: 'user', content: `Generate strategic thumbnail concept for:\n"${concept}"\n\nBase guidance: ${basePrompt}` }
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

export async function generateThumbnail(thumbnailConcept, aspectRatios, userId) {
  const apiKey = await getApiKey(userId, 'openai');
  if (!apiKey) throw new Error('OpenAI not connected. Add your API key in the Integrations page.');
  
  const results = {};
  
  // Generate thumbnail for each aspect ratio using the strategic prompts
  for (const ratio of aspectRatios) {
    const size = ratio === '16:9' ? '1792x1024' : ratio === '9:16' ? '1024x1792' : '1024x1024';
    const promptKey = `image_prompt_${ratio.replace(':', '_')}`;
    const prompt = thumbnailConcept[promptKey] || thumbnailConcept.image_prompt_16_9 || `YouTube thumbnail: ${thumbnailConcept.text_overlay}`;
    
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'hd'
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
