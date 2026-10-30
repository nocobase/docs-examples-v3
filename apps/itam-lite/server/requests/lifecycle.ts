import { z } from 'zod';
import {
  defineEffect,
  defineLifecycle,
  type GuardVerdict,
  type Lifecycle,
  type LifecycleRecord,
  type ParameterGroup,
  type TransitionContext,
} from '@nocobase/lifecycle';
import { deviceCategories, type DeviceCategory } from '../devices/schemas.js';
import type { RequestState } from './schemas.js';

/**
 * The device request workflow (docs/design.md §4). The state lives only in `deviceRequests.status` and changes only
 * through these transitions. Names are stored with every log entry and effect run: never rename the lifecycle, a
 * state, a transition or an effect.
 */
export const REQUEST_LIFECYCLE = 'deviceRequests';

export interface DeviceRequestRecord extends LifecycleRecord {
  readonly status: RequestState;
  readonly requestNo: string;
  readonly requesterId: string;
  readonly category: DeviceCategory;
  readonly needsApproval: boolean;
  readonly decisionComment: string;
  readonly deviceId: string | null;
}

export interface ApprovalParameters {
  /** Categories that always go to an asset manager. */
  readonly approvalCategories: DeviceCategory[];
  /** A requester already using this many devices needs approval for another. */
  readonly deviceLimit: number;
}

/** Who to tell. Effects run after commit, so these read through the database manager. */
export interface RequestNotifications {
  notify(input: {
    readonly key: string;
    readonly to: 'assetManagers' | 'itSupport' | 'requester';
    readonly record: DeviceRequestRecord;
    readonly message:
      'approvalRequested' | 'readyToIssue' | 'approved' | 'rejected' | 'issued';
  }): Promise<void>;
}

export interface DeviceRequestTypes {
  record: DeviceRequestRecord;
  state: RequestState;
  parameters: ApprovalParameters;
  services: { readonly notifications: RequestNotifications };
}

type Context = TransitionContext<DeviceRequestTypes>;

/** Workflow management → Device requests: what needs an asset manager's approval. */
export const approvalRules: ParameterGroup = {
  key: 'deviceRequestApproval',
  title: 'Approval rules',
  schemaVersion: 1,
  fields: {
    approvalCategories: {
      type: 'object',
      title: 'Categories that need approval',
      parse: (value) => [
        ...new Set(
          z
            .array(z.enum(deviceCategories))
            .max(deviceCategories.length)
            .parse(value),
        ),
      ],
      bindings: [{ transition: 'submit' }],
    },
    deviceLimit: {
      type: 'number',
      title: 'Devices a person may hold without approval',
      minimum: 0,
      maximum: 20,
      parse: (value) => z.number().int().min(0).max(20).parse(value),
      bindings: [{ transition: 'submit' }],
    },
  },
};

const requesterOnly = ({ record, actor }: Context): GuardVerdict =>
  actor.id === record.requesterId || {
    code: 'REQUESTER_ONLY',
    message: 'Only the requester can do this.',
  };

const notRequester = ({ record, actor }: Context): GuardVerdict =>
  actor.id !== record.requesterId || {
    code: 'OWN_REQUEST',
    message: 'You cannot decide your own request.',
  };

const touched = ({ now }: { readonly now: Date }) => ({ updatedAt: now });

const retry = { attempts: 5, backoffMs: 5_000, factor: 3 } as const;

const tellAssetManagers = defineEffect<DeviceRequestTypes>({
  name: 'deviceRequests.notifyAssetManagers',
  retry,
  timeoutMs: 60_000,
  run: ({ record, services, idempotencyKey }) =>
    services.notifications.notify({
      key: idempotencyKey,
      to: 'assetManagers',
      record,
      message: 'approvalRequested',
    }),
});

const tellItSupport = defineEffect<DeviceRequestTypes>({
  name: 'deviceRequests.notifyItSupport',
  retry,
  timeoutMs: 60_000,
  run: ({ record, services, idempotencyKey }) =>
    services.notifications.notify({
      key: idempotencyKey,
      to: 'itSupport',
      record,
      message: 'readyToIssue',
    }),
});

const tellRequester = (message: 'approved' | 'rejected' | 'issued') =>
  defineEffect<DeviceRequestTypes>({
    name: `deviceRequests.notifyRequester.${message}`,
    retry,
    timeoutMs: 60_000,
    run: ({ record, services, idempotencyKey }) =>
      services.notifications.notify({
        key: idempotencyKey,
        to: 'requester',
        record,
        message,
      }),
  });

export const deviceRequestLifecycle: Lifecycle<DeviceRequestTypes> =
  defineLifecycle<DeviceRequestTypes>({
    name: REQUEST_LIFECYCLE,
    initial: 'draft',
    parameters: { approvalCategories: ['laptop', 'phone'], deviceLimit: 2 },
    parameterConfiguration: { readMode: 'live', groups: [approvalRules] },
    states: [
      'draft',
      'pendingApproval',
      'readyToIssue',
      { name: 'issued', final: true },
      { name: 'rejected', final: true },
      { name: 'withdrawn', final: true },
    ],
    create: {
      guard: ({ values, actor }) =>
        actor.id === values.requesterId ||
        'Request a device for yourself only.',
    },
    transitions: {
      submit: {
        title: 'Submit',
        from: 'draft',
        to: ['pendingApproval', 'readyToIssue'],
        guard: requesterOnly,
        // `heldDevices` is counted by the server in the same transaction, never sent by the browser.
        route: ({ record, input, parameters }) =>
          parameters.approvalCategories.includes(record.category) ||
          Number(input.heldDevices ?? 0) >= parameters.deviceLimit
            ? 'pendingApproval'
            : 'readyToIssue',
        set: ({ to, now }) => ({
          needsApproval: to === 'pendingApproval',
          updatedAt: now,
        }),
      },
      approve: {
        title: 'Approve',
        from: 'pendingApproval',
        to: 'readyToIssue',
        guard: notRequester,
        accept: ['decisionComment'],
        set: ({ actor, now }) => ({ decidedById: actor.id, updatedAt: now }),
        effects: [tellRequester('approved')],
      },
      reject: {
        title: 'Reject',
        from: 'pendingApproval',
        to: 'rejected',
        guard: notRequester,
        validate: (input) =>
          typeof input.decisionComment === 'string' &&
          input.decisionComment.trim()
            ? []
            : [{ field: 'decisionComment', message: 'Give a reason.' }],
        accept: ['decisionComment'],
        set: ({ actor, now }) => ({ decidedById: actor.id, updatedAt: now }),
        effects: [tellRequester('rejected')],
      },
      issue: {
        title: 'Issue',
        from: 'readyToIssue',
        to: 'issued',
        validate: (input) =>
          typeof input.deviceId === 'string' && input.deviceId
            ? []
            : [{ field: 'deviceId', message: 'Choose a device.' }],
        accept: ['deviceId'],
        set: ({ actor, now }) => ({ issuedById: actor.id, updatedAt: now }),
        effects: [tellRequester('issued')],
      },
      withdraw: {
        title: 'Withdraw',
        from: ['pendingApproval', 'readyToIssue'],
        to: 'withdrawn',
        guard: requesterOnly,
        set: touched,
      },
    },
    onEnter: {
      pendingApproval: [tellAssetManagers],
      readyToIssue: [tellItSupport],
    },
  });
