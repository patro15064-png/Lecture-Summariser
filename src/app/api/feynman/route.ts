import { NextRequest, NextResponse } from 'next/server';
import { evaluateFeynmanExplanation } from '@/lib/gemini';
import { ConceptNode, LectureArtifact } from '@/types/lecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientHeaderKey = req.headers.get('x-gemini-key');
    const effectiveKey = clientHeaderKey?.trim() || process.env.GEMINI_API_KEY?.trim();

    const body = await req.json().catch(() => null);
    if (!body || !body.concept || !body.studentExplanation || !body.artifact) {
      return NextResponse.json(
        { error: 'Request payload must include concept, studentExplanation, and artifact.' },
        { status: 400 }
      );
    }

    const { concept, studentExplanation, artifact } = body as {
      concept: ConceptNode;
      studentExplanation: string;
      artifact: LectureArtifact;
    };

    const evaluation = await evaluateFeynmanExplanation({
      concept,
      studentExplanation,
      artifact,
      apiKey: effectiveKey,
    });

    return NextResponse.json({
      success: true,
      evaluation,
      source: effectiveKey ? 'gemini' : 'heuristic-rubric',
    });
  } catch (error: unknown) {
    console.error('[API /api/feynman Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process Feynman evaluation.',
      },
      { status: 500 }
    );
  }
}
