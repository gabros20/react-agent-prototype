import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Proxy to backend Express API server
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    
    const body = await req.json();
    
    const response = await fetch(`${API_URL}/v1/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Agent API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
