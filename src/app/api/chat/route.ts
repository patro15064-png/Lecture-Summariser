import { NextRequest, NextResponse } from 'next/server';
import { chatWithLecture } from '@/lib/gemini';
import { LectureArtifact } from '@/types/lecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const clientHeaderKey = req.headers.get('x-api-key') || req.headers.get('x-gemini-key');
    const clientProvider = req.headers.get('x-provider') || 'gemini';
    const clientModel = req.headers.get('x-model') || undefined;
    const clientBaseUrl = req.headers.get('x-base-url') || undefined;

    const body = await req.json().catch(() => null);
    if (!body || !body.message || !body.artifact) {
      return NextResponse.json(
        { error: 'Request payload must include message and artifact.' },
        { status: 400 }
      );
    }

    const { message, history, artifact, mode, apiKey: bodyKey, provider: bodyProvider, model: bodyModel, baseUrl: bodyBaseUrl } = body as {
      message: string;
      history?: Array<{ role: 'user' | 'model'; content: string }>;
      artifact: LectureArtifact;
      mode?: 'socratic' | 'direct';
      apiKey?: string;
      provider?: string;
      model?: string;
      baseUrl?: string;
    };

    const effectiveKey = (bodyKey || clientHeaderKey || process.env.GEMINI_API_KEY || '').trim();
    const effectiveProvider = bodyProvider || clientProvider;
    const effectiveModel = bodyModel || clientModel;
    const effectiveBaseUrl = bodyBaseUrl || clientBaseUrl;

    const reply = await chatWithLecture({
      message,
      history,
      artifact,
      mode: mode || 'socratic',
      apiKey: effectiveKey,
      provider: effectiveProvider,
      model: effectiveModel,
      baseUrl: effectiveBaseUrl,
    });

    return NextResponse.json({
      success: true,
      reply,
      source: effectiveKey ? `${effectiveProvider}-real-ai` : 'contextual-heuristics',
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
