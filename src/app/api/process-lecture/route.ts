import { NextRequest, NextResponse } from 'next/server';
import { processLectureWithGemini } from '@/lib/gemini';
import { DEMO_LECTURES } from '@/data/demoLectures';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Zero-Trust API Key extraction (transient header prioritized)
    const clientHeaderKey = req.headers.get('x-gemini-key');
    const effectiveKey = clientHeaderKey?.trim() || process.env.GEMINI_API_KEY?.trim();

    // 2. Parse request payload with safety bounds
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const { text, base64Data, mimeType, demoId } = body;

    // Check if user specifically requested a built-in demo
    if (demoId) {
      const foundDemo = DEMO_LECTURES.find((d) => d.id === demoId) || DEMO_LECTURES[0];
      return NextResponse.json({
        success: true,
        source: 'demo-dataset',
        artifact: foundDemo,
      });
    }

    // Ensure at least text notes or multimodal base64 media was supplied
    if (!text && !base64Data) {
      return NextResponse.json(
        { error: 'Payload must provide either text notes or multimodal media content.' },
        { status: 400 }
      );
    }

    // 3. Process with self-healing Gemini engine
    const artifact = await processLectureWithGemini({
      text,
      base64Data,
      mimeType,
      apiKey: effectiveKey,
    });

    return NextResponse.json({
      success: true,
      source: effectiveKey ? 'gemini-multimodal' : 'demo-fallback',
      artifact,
    });
  } catch (error: unknown) {
    console.error('[API /process-lecture Error]:', error);
    // Graceful failsafe: return the first demo lecture rather than crashing the client
    return NextResponse.json(
      {
        success: true,
        source: 'failsafe-demo',
        artifact: DEMO_LECTURES[0],
        warning: 'Encountered unexpected error during processing; returned reference lecture.',
      },
      { status: 200 }
    );
  }
}
