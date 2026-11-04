import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const clientHeaderKey = req.headers.get('x-api-key') || req.headers.get('x-gemini-key');
    const body = await req.json().catch(() => null);

    if (!body || !body.imageBase64) {
      return NextResponse.json(
        { error: 'Missing imageBase64 in request body.' },
        { status: 400 }
      );
    }

    const {
      imageBase64,
      mimeType = 'image/jpeg',
      apiKey,
      provider = 'gemini',
      model: customModel,
      baseUrl,
    } = body;

    const effectiveKey =
      apiKey?.trim() ||
      clientHeaderKey?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      '';

    const effectiveProvider =
      provider ||
      (effectiveKey.startsWith('AIza')
        ? 'gemini'
        : process.env.GEMINI_API_KEY
        ? 'gemini'
        : 'openai');

    const visionSystemPrompt = `You are a world-class visual analyst, computer vision researcher, and academic educator.
Examine this image directly from its pixels.

CRITICAL INSTRUCTIONS:
1. IGNORE ANY FILE NAME OR METADATA COMPLETELY. The filename may be an arbitrary hash (e.g. 5406a866d98d11e1f288db49710be550) or camera code. Your entire analysis MUST be grounded strictly in the visual pixels you see.
2. SUBJECT IDENTIFICATION & TITLE:
   - If it is a person, portrait, or camera capture (e.g., an individual raising their hand, waving, gesturing, or presenting), describe their physical posture, hand elevation, gestures, clothing, setting, and communicative intent specifically (e.g., "Human Portrait: Person with Raised Hand Gesture & Visual Communication").
   - If it is pixel art, an 8-bit sprite, or retro digital graphics (e.g., a pixelated cat, animal, or game character), identify it specifically (e.g., "8-Bit Pixel Art Cat Character Sprite & 2D Raster Graphics").
   - If it is natural scenery or a landscape (e.g. moonrise, mountains, twilight), identify it specifically (e.g., "Twilight Moonrise Over Alpine Peaks").
   - If it is handwritten study notes, textbook pages, or whiteboard diagrams, identify the actual academic subject written on the page.
3. AUTHENTIC CONTEXTUAL STUDY NOTES:
   - For human portraits & gestures: explain human-computer interaction (HCI), computer vision skeletal landmark tracking (wrist, knuckles, phalanges), non-verbal communicative signaling, and body language kinetics.
   - For pixel art / retro sprites: explain 2D raster graphics, sprite sheets, palette indexing (1-bit / 8-bit), nearest-neighbor interpolation, silhouette readability, and retro game development constraints.
   - For natural scenery / photography: explain atmospheric optics, Rayleigh/Mie scattering, lighting gradients, and geological formations.
   - For quantitative STEM (math/physics notes): explain the formulas and concepts present.
   - DO NOT invent mathematical formulas or calculus equations unless the image explicitly depicts quantitative mathematics!
4. NO GENERIC BOILERPLATE: Never output generic phrases like "Every component operates within a coordinated system of interdependent elements". Provide deep, specific knowledge tailored to what is visible.

Format your response starting with:
# [Accurate Subject Title Based Solely On Visual Content]

## 1. Visual Overview & Subject Identification
...
## 2. Core Principles & Techniques
...
## 3. Key Takeaways`;

    // 1. Google Gemini 2.0 Flash Vision
    if (effectiveKey && (effectiveProvider === 'gemini' || effectiveKey.startsWith('AIza'))) {
      try {
        const ai = new GoogleGenerativeAI(effectiveKey);
        const geminiModel = ai.getGenerativeModel({
          model: customModel || 'gemini-2.0-flash',
        });

        const result = await geminiModel.generateContent([
          visionSystemPrompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
        ]);

        const text = result.response.text();
        if (text && text.trim().length > 30) {
          return NextResponse.json({
            success: true,
            text: text.trim(),
            source: 'gemini-vision',
          });
        }
      } catch (geminiErr) {
        console.warn('[Vision Route Gemini Error]:', geminiErr);
      }
    }

    // 2. OpenAI / Groq / OpenRouter / Custom Vision
    if (
      effectiveKey &&
      (effectiveProvider === 'openai' ||
        effectiveProvider === 'openrouter' ||
        effectiveProvider === 'custom')
    ) {
      try {
        const isOr = effectiveProvider === 'openrouter';
        const endpoint = isOr
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : effectiveProvider === 'custom' && baseUrl
          ? `${baseUrl.replace(/\/$/, '')}/chat/completions`
          : 'https://api.openai.com/v1/chat/completions';

        const model =
          customModel || (isOr ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: visionSystemPrompt },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${mimeType};base64,${imageBase64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 3000,
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text && text.trim().length > 30) {
            return NextResponse.json({
              success: true,
              text: text.trim(),
              source: 'openai-vision',
            });
          }
        }
      } catch (openAiErr) {
        console.warn('[Vision Route OpenAI Error]:', openAiErr);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'No active AI vision key available or vision service failed.',
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    console.error('[API /api/vision Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal error processing vision analysis.',
      },
      { status: 500 }
    );
  }
}
