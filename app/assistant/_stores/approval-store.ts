'use client';

import { create } from 'zustand';

export interface ApprovalRequest {
  approvalId?: string;  // New: AI SDK v6 approvalId
  traceId: string;
  stepId: string;
  toolName: string;
  input: unknown;
  description: string;
}

interface ApprovalState {
  pendingApproval: ApprovalRequest | null;
  setPendingApproval: (approval: ApprovalRequest | null) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  pendingApproval: null,
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
}));
