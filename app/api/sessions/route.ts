import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// GET /api/sessions - List all sessions
export async function GET() {
  try {
    const response = await fetch(`${API_URL}/v1/sessions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message }, statusCode: 500 },
      { status: 500 },
    );
  }
}

// POST /api/sessions - Create new session
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message }, statusCode: 500 },
      { status: 500 },
    );
  }
}
