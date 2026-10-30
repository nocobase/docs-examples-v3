import type { LifecycleDescription } from '@nocobase/lifecycle';
import type { DeviceCategory } from '../devices/types.js';

export const requestStates = [
  'pendingApproval',
  'readyToIssue',
  'issued',
  'rejected',
  'withdrawn',
] as const;
export type RequestState = 'draft' | (typeof requestStates)[number];

export interface DeviceRequest {
  id: string;
  requestNo: string;
  requesterId: string;
  requesterName: string | null;
  category: DeviceCategory;
  reason: string;
  /** `YYYY-MM-DD`; empty on requests submitted before the field existed. */
  neededBy: string | null;
  status: RequestState;
  needsApproval: boolean;
  decisionComment: string;
  decidedById: string | null;
  decidedByName: string | null;
  deviceId: string | null;
  deviceAssetTag: string | null;
  lifecycleVersion: number;
  createdAt: string;
}

export interface RequestList {
  data: DeviceRequest[];
  meta: { page: number; pageSize: number; total: number };
}

export interface HistoryEntry {
  id: string;
  version: number;
  at: string;
  transition: string;
  from: string | null;
  to: string;
  actorId: string;
}

export interface RequestView {
  state: string;
  version: number | null;
  available: {
    name: string;
    allowed: boolean;
    blockers: { code: string; message: string }[];
  }[];
  history: { transitions: HistoryEntry[]; effectRuns: unknown[] };
}

export interface RequestDetail {
  request: DeviceRequest;
  view: RequestView;
  actors: Record<string, string>;
  can: { approve: boolean; issue: boolean; withdraw: boolean };
}

export type { LifecycleDescription };
