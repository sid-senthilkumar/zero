import { getSettings } from './settings.js';

const CLAUDE_MODEL = 'claude-opus-4-5';
const TOGETHER_IMAGE_MODEL = 'black-forest-labs/FLUX.1-schnell-Free';

export async function predictBaby({ momImageBase64, dadImageBase64, momMimeType, dadMimeType, gender }) {
    const settings = await getSettings();

    if (!settings.claudeApiKey) {
        throw new Error('Claude API key required. Go to Settings.');
    }

    const analysis = await analyzeParentFaces(settings, momImageBase64, dadImageBase64, momMimeType, dadMimeType, gender);

    if (!settings.togetherApiKey) {
        throw new Error('Together AI API key required for image generation. Go to Settings.');
    }

    const babyImageUrl = await generateBabyImage(settings, analysis.prompt);

    return { babyImageUrl, analysis };
}

async function analyzeParentFaces(settings, momBase64, dadBase64, momMime, dadMime, gender) {
    const genderLabel = gender === 'boy' ? 'baby boy' : gender === 'girl' ? 'baby girl' : 'baby';
    const genderPronoun = gender === 'boy' ? 'his' : gender === 'girl' ? 'her' : 'their';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.claudeApiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1500,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: momMime, data: momBase64 }
                    },
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: dadMime, data: dadBase64 }
                    },
                    {
                        type: 'text',
                        text: `You are a genetic features analyst. The first image is the MOTHER, the second is the FATHER.

Carefully analyze the visible facial genetics of each parent, then predict what their ${genderLabel} would look like using Mendelian inheritance principles (darker eyes dominant over lighter, stronger jaw tends to pass through, etc.).

Respond ONLY with valid JSON in this exact structure:
{
  "motherFeatures": {
    "eyes": "brief description of eye color and shape",
    "nose": "brief description",
    "lips": "brief description",
    "faceShape": "oval/round/square/heart/diamond",
    "skinTone": "brief description",
    "hairColor": "brief description"
  },
  "fatherFeatures": {
    "eyes": "brief description of eye color and shape",
    "nose": "brief description",
    "lips": "brief description",
    "faceShape": "oval/round/square/heart/diamond",
    "skinTone": "brief description",
    "hairColor": "brief description"
  },
  "inheritance": [
    {"feature": "Eyes", "from": "Mother", "percent": 65, "description": "one sentence about this feature in the child"},
    {"feature": "Nose", "from": "Father", "percent": 70, "description": "one sentence"},
    {"feature": "Lips", "from": "Mother", "percent": 55, "description": "one sentence"},
    {"feature": "Face Shape", "from": "Both", "percent": 50, "description": "one sentence"},
    {"feature": "Skin Tone", "from": "Both", "percent": 50, "description": "one sentence"},
    {"feature": "Hair", "from": "Father", "percent": 60, "description": "one sentence"}
  ],
  "prompt": "photorealistic portrait, professional studio photography, adorable ${genderLabel} approximately 2 years old, [INSERT DETAILED CHILD FACE DESCRIPTION HERE combining both parents' genetic features], chubby cheeks, innocent expression, soft bokeh background, warm studio lighting, 8K, sharp focus, Canon EOS R5, 85mm lens"
}

For the prompt field, replace [INSERT DETAILED CHILD FACE DESCRIPTION HERE] with a specific description of the child's face that realistically blends both parents' features. Be very specific about: eye color and shape, nose shape, lip shape, skin tone, hair color and texture, face shape. The prompt should be optimized for a photorealistic image generation model.`
                    }
                ]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API error: ${err}`);
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse face analysis. Please try again.');
    }

    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        throw new Error('Invalid response format from analysis. Please try again.');
    }
}

async function generateBabyImage(settings, prompt) {
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.togetherApiKey}`
        },
        body: JSON.stringify({
            model: TOGETHER_IMAGE_MODEL,
            prompt,
            n: 1,
            width: 512,
            height: 512,
            steps: 4,
            response_format: 'b64_json'
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Image generation error: ${err}`);
    }

    const data = await response.json();
    const item = data.data?.[0];
    if (!item) throw new Error('No image returned from generation API.');

    if (item.b64_json) {
        return `data:image/png;base64,${item.b64_json}`;
    }
    if (item.url) {
        return item.url;
    }
    throw new Error('Unexpected image response format.');
}
