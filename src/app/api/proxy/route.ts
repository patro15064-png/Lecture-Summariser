import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stateless Next.js route handler for bypassing browser CORS on providers
 * like Anthropic or endpoints that do not set Access-Control-Allow-Origin.
 *
 * ZERO-TRUST SECURITY:
 * - Never logs keys.
 * - Never persists payloads.
 * - Passes transient credentials through to upstream and discards memory immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload || !payload.endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    const { provider, apiKey, endpoint, method = 'POST', headers = {}, body } = payload;
    const requestHeaders: Record<string, string> = { ...headers };

    if (provider === 'anthropic') {
      requestHeaders['x-api-key'] = apiKey || '';
      requestHeaders['anthropic-version'] = '2023-06-01';
      requestHeaders['Content-Type'] = 'application/json';
    } else if (apiKey) {
      requestHeaders['Authorization'] = `Bearer ${apiKey}`;
    }

    const upstreamRes = await fetch(endpoint, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = upstreamRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await upstreamRes.json();
      return NextResponse.json(data, { status: upstreamRes.status });
    }

    const text = await upstreamRes.text();
    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: { 'Content-Type': contentType || 'text/plain' },
    });
  } catch (error: unknown) {
    console.error('[Stateless Proxy Error]:', error);
    return NextResponse.json(
      { error: 'Failed to proxy request upstream.' },
      { status: 502 }
    );
  }
}
