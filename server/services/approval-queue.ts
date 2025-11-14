/**
 * Approval Queue - In-Memory Queue for Tool Approval Requests
 * 
 * Handles the request/response flow for tool approvals:
 * 1. Server creates approval request (when tool needs approval)
 * 2. Frontend fetches pending approval
 * 3. User approves/rejects
 * 4. Server receives response and continues execution
 */

interface ApprovalRequest {
  approvalId: string
  toolName: string
  input: any
  description?: string
  timestamp: Date
}

interface ApprovalResponse {
  approved: boolean
  reason?: string
  timestamp: Date
}

type ApprovalResolver = (response: ApprovalResponse) => void

class ApprovalQueue {
  private pendingRequests = new Map<string, ApprovalRequest>()
  private resolvers = new Map<string, ApprovalResolver>()
  private responses = new Map<string, ApprovalResponse>()
  
  /**
   * Create approval request and wait for response
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    console.log('[ApprovalQueue] Creating approval request:', {
      approvalId: request.approvalId,
      toolName: request.toolName,
      timestamp: request.timestamp.toISOString()
    })
    
    this.pendingRequests.set(request.approvalId, request)
    
    // Create promise that resolves when user responds
    const responsePromise = new Promise<ApprovalResponse>((resolve) => {
      this.resolvers.set(request.approvalId, resolve)
      console.log('[ApprovalQueue] Resolver registered for:', request.approvalId)
    })
    
    // Timeout after 5 minutes
    const timeoutPromise = new Promise<ApprovalResponse>((resolve) => {
      setTimeout(() => {
        console.log('[ApprovalQueue] Approval timed out:', request.approvalId)
        resolve({ 
          approved: false, 
          reason: 'Approval request timed out (5 minutes)',
          timestamp: new Date()
        })
        this.cleanup(request.approvalId)
      }, 5 * 60 * 1000)
    })
    
    const result = await Promise.race([responsePromise, timeoutPromise])
    
    console.log('[ApprovalQueue] Approval resolved:', {
      approvalId: request.approvalId,
      approved: result.approved,
      reason: result.reason
    })
    
    return result
  }
  
  /**
   * Submit approval response (from frontend)
   */
  async respondToApproval(approvalId: string, approved: boolean, reason?: string) {
    console.log('[ApprovalQueue] Attempting to respond to approval:', {
      approvalId,
      approved,
      reason,
      hasResolver: this.resolvers.has(approvalId),
      hasPendingRequest: this.pendingRequests.has(approvalId),
      allResolvers: Array.from(this.resolvers.keys()),
      allPending: Array.from(this.pendingRequests.keys())
    })
    
    const resolver = this.resolvers.get(approvalId)
    
    if (!resolver) {
      // More detailed error message
      const pendingIds = Array.from(this.resolvers.keys())
      console.error('[ApprovalQueue] No resolver found!', {
        approvalId,
        pendingApprovalIds: pendingIds,
        queueStats: this.getStats()
      })
      
      throw new Error(
        `No pending approval request for ID: ${approvalId}. ` +
        `Pending IDs: ${pendingIds.join(', ') || 'none'}. ` +
        `This might happen if the approval timed out (5 min) or the ID doesn't match.`
      )
    }
    
    const response: ApprovalResponse = {
      approved,
      reason,
      timestamp: new Date()
    }
    
    // Store response
    this.responses.set(approvalId, response)
    
    console.log('[ApprovalQueue] Resolving approval:', { approvalId, approved })
    
    // Resolve promise (unblocks server execution)
    resolver(response)
    
    // Cleanup after 1 minute
    setTimeout(() => {
      this.cleanup(approvalId)
    }, 60 * 1000)
    
    return response
  }
  
  /**
   * Get pending request (for frontend to display)
   */
  getPendingRequest(approvalId: string): ApprovalRequest | undefined {
    return this.pendingRequests.get(approvalId)
  }
  
  /**
   * Get all pending requests
   */
  getAllPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values())
  }
  
  /**
   * Check if approval is pending
   */
  isPending(approvalId: string): boolean {
    return this.resolvers.has(approvalId)
  }
  
  /**
   * Cleanup request data
   */
  private cleanup(approvalId: string) {
    this.pendingRequests.delete(approvalId)
    this.resolvers.delete(approvalId)
    this.responses.delete(approvalId)
  }
  
  /**
   * Get queue stats (for monitoring)
   */
  getStats() {
    return {
      pendingCount: this.pendingRequests.size,
      resolversCount: this.resolvers.size,
      responsesCount: this.responses.size
    }
  }
}

// Singleton instance
export const approvalQueue = new ApprovalQueue()
