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

    const visionSystemPrompt = `You are a world-class academic educator, curriculum synthesizer, and visual analyst.
Analyze this image thoroughly and objectively:

1. SUBJECT IDENTIFICATION:
Determine what this image actually depicts:
- Is it a photograph of nature, a landscape, astronomical phenomena, or scenery?
- Is it handwritten notes, textbook pages, whiteboard drawings, or diagrams?
- Is it biology, chemistry, physics, mathematics, history, literature, or art?

2. PRECISE VISUAL TRANSCRIPTION & OBSERVATIONS:
- If there is handwritten text or printed words, transcribe them verbatim.
- If it is natural scenery, a landscape, or a photo, describe what is visible: the physical topography, lighting, celestial bodies, colors, and environmental context.
- If it is a diagram or schematic, describe all components, arrows, and interactions.

3. SCIENTIFIC & EDUCATIONAL PRINCIPLES:
- Explain the real mechanisms, natural phenomena, historical context, or conceptual laws depicted.
- CRITICAL INSTRUCTION ON FORMULAS: DO NOT invent mathematical formulas or calculus equations unless this image is genuinely about mathematics, quantitative physics, or engineering! For landscapes, scenery, or photography, focus on atmospheric optics, geology, lighting, and environmental science.

4. KEY CONCEPTS & LEARNING TAKEAWAYS:
- Provide 3-5 grounded takeaways that would help a student understand and master this subject.

Format with clear Markdown headers (e.g. "## 1. Overview & Subject Identification", "## 2. Key Mechanisms & Observations", "## 3. Core Principles & Real-World Science", "## 4. Key Takeaways").`;

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
            max_tokens: 4000,
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
