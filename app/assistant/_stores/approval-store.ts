'use client';

import { create } from 'zustand';

export interface ApprovalRequest {
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
