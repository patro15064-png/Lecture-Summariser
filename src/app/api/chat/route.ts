import { NextRequest, NextResponse } from 'next/server';
import { chatWithLecture } from '@/lib/gemini';
import { LectureArtifact } from '@/types/lecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientHeaderKey = req.headers.get('x-gemini-key');
    const effectiveKey = clientHeaderKey?.trim() || process.env.GEMINI_API_KEY?.trim();

    const body = await req.json().catch(() => null);
    if (!body || !body.message || !body.artifact) {
      return NextResponse.json(
        { error: 'Request payload must include message and artifact.' },
        { status: 400 }
      );
    }

    const { message, history, artifact, mode } = body as {
      message: string;
      history?: Array<{ role: 'user' | 'model'; content: string }>;
      artifact: LectureArtifact;
      mode?: 'socratic' | 'direct';
    };

    const reply = await chatWithLecture({
      message,
      history,
      artifact,
      mode: mode || 'socratic',
      apiKey: effectiveKey,
    });

    return NextResponse.json({
      success: true,
      reply,
      source: effectiveKey ? 'gemini' : 'contextual-heuristics',
    });
  } catch (error: unknown) {
    console.error('[API /api/chat Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat query.',
        reply: 'I encountered an error retrieving insights. Please check your network or try again.',
      },
      { status: 500 }
    );
  }
}
