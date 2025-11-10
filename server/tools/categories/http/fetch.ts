import { z } from 'zod'
import { createCMSTool } from '../../registry'

// HTTP fetch (allowlisted domains only)
export const fetchTool = createCMSTool({
  id: 'http.fetch',
  category: 'http',
  riskLevel: 'moderate',
  requiresApproval: false,
  allowedModes: ['cms-crud', 'ask'],
  tags: ['http', 'external'],
  description:
    'Fetch data from external URL (GET only). Only allowlisted domains permitted for security.',
  inputSchema: z.object({
    url: z.string().url().describe('URL to fetch (must be allowlisted)')
  }),
  execute: async (input, context) => {
    const { logger, traceId } = context

    // Get allowlist from env
    const allowlist = process.env.HTTP_FETCH_ALLOWLIST?.split(',') || ['example.com']

    // Validate URL is allowlisted
    const url = new URL(input.url)
    const isAllowed = allowlist.some((domain) => url.hostname.endsWith(domain.trim()))

    if (!isAllowed) {
      throw new Error(
        `Domain not allowlisted: ${url.hostname}. Allowed domains: ${allowlist.join(', ')}`
      )
    }

    logger.info({ traceId, tool: 'http.fetch', url: input.url })

    try {
      const response = await fetch(input.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'ReAct-CMS-Agent/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10s timeout
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      let data: any

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      logger.info({ traceId, tool: 'http.fetch', result: 'success', status: response.status })

      return {
        url: input.url,
        status: response.status,
        contentType,
        data
      }
    } catch (error) {
      logger.error({ traceId, tool: 'http.fetch', error: (error as Error).message })
      throw new Error(`Fetch failed: ${(error as Error).message}`)
    }
  }
})
