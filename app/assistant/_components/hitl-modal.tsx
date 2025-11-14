'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApprovalStore } from '../_stores/approval-store';
import { AlertTriangle } from 'lucide-react';

export function HITLModal() {
  const { pendingApproval, setPendingApproval } = useApprovalStore();

  const handleApprove = async () => {
    if (!pendingApproval) return;

    // Extract approvalId from the approval request
    const approvalId = (pendingApproval as any).approvalId || pendingApproval.stepId;

    try {
      // Send approval to backend via new endpoint
      const response = await fetch(`/api/agent/approval/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          reason: 'User approved via modal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send approval');
      }

      console.log('Approved:', pendingApproval);
      setPendingApproval(null);
    } catch (error) {
      console.error('Error approving:', error);
      alert('Failed to send approval');
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;

    // Extract approvalId from the approval request
    const approvalId = (pendingApproval as any).approvalId || pendingApproval.stepId;

    try {
      // Send rejection to backend via new endpoint
      const response = await fetch(`/api/agent/approval/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          reason: 'User rejected via modal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send rejection');
      }

      console.log('Rejected:', pendingApproval);
      setPendingApproval(null);
    } catch (error) {
      console.error('Error rejecting:', error);
      alert('Failed to send rejection');
    }
  };

  return (
    <Dialog open={!!pendingApproval} onOpenChange={() => setPendingApproval(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Approval Required
          </DialogTitle>
          <DialogDescription>
            The agent wants to perform a high-risk operation and needs your confirmation.
          </DialogDescription>
        </DialogHeader>

        {pendingApproval && (
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm mb-1">Tool:</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">{pendingApproval.toolName}</code>
            </div>

            <div>
              <p className="font-medium text-sm mb-1">Description:</p>
              <p className="text-sm text-muted-foreground">{pendingApproval.description}</p>
            </div>

            <div>
              <p className="font-medium text-sm mb-1">Input:</p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(pendingApproval.input, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleReject}>
            Reject
          </Button>
          <Button onClick={handleApprove}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
