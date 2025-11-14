/**
 * Next.js API Route - Approval Response Proxy
 * Forwards approval decisions from frontend to Express backend
 */

export async function POST(
  request: Request,
  props: { params: Promise<{ approvalId: string }> }
) {
  try {
    // Next.js 15+: params is now a Promise
    const params = await props.params
    const { approvalId } = params
    const body = await request.json()

    // Forward to Express backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
    const response = await fetch(`${backendUrl}/v1/agent/approval/${approvalId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return Response.json(data, { status: response.status })
    }

    return Response.json(data)
  } catch (error) {
    console.error('Approval proxy error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
