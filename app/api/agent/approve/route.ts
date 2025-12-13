import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to Express backend
    const response = await fetch(`${API_URL}/v1/agent/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Approval API error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message }, statusCode: 500 },
      { status: 500 }
    );
  }
}
