import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// DELETE /api/sessions/:sessionId/checkpoint - Clear checkpoint
export async function DELETE(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const response = await fetch(`${API_URL}/v1/sessions/${sessionId}/checkpoint`, {
      method: "DELETE",
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
