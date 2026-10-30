import { describe, expect, it } from 'vitest';
import { createLifecycleTestKit } from '@nocobase/lifecycle/testing';
import {
  deviceRequestLifecycle,
  type RequestNotifications,
} from '../../server/requests/lifecycle.js';

function setup(parameters?: {
  approvalCategories?: ('laptop' | 'phone' | 'monitor')[];
  deviceLimit?: number;
}) {
  const sent: string[] = [];
  const notifications: RequestNotifications = {
    notify: async ({ to, message }) => {
      sent.push(`${to}:${message}`);
    },
  };
  const kit = createLifecycleTestKit(deviceRequestLifecycle, {
    services: { notifications },
    parameters,
  });
  const request = (category: string) =>
    kit.start(
      {
        requesterId: 'alice',
        requestNo: 'REQ-1',
        category,
        needsApproval: false,
        decisionComment: '',
      },
      { actor: 'alice' },
    );
  return { kit, sent, request };
}

describe('device request workflow', () => {
  it('sends laptops to an asset manager and monitors straight to IT support', async () => {
    const { kit, sent, request } = setup();
    const laptop = await request('laptop');
    expect(
      await kit.fire(laptop, 'submit', { heldDevices: 0 }, { actor: 'alice' }),
    ).toMatchObject({
      status: 'pendingApproval',
      needsApproval: true,
    });
    const monitor = await request('monitor');
    expect(
      await kit.fire(monitor, 'submit', { heldDevices: 0 }, { actor: 'alice' }),
    ).toMatchObject({
      status: 'readyToIssue',
      needsApproval: false,
    });
    expect(sent).toEqual([
      'assetManagers:approvalRequested',
      'itSupport:readyToIssue',
    ]);
  });

  it('needs approval once the requester reaches the device limit', async () => {
    const { kit, request } = setup({ deviceLimit: 1 });
    const monitor = await request('monitor');
    expect(
      (
        await kit.fire(
          monitor,
          'submit',
          { heldDevices: 1 },
          { actor: 'alice' },
        )
      ).status,
    ).toBe('pendingApproval');
  });

  it('keeps the requester from deciding and others from withdrawing', async () => {
    const { kit, sent, request } = setup();
    const laptop = await request('laptop');
    await kit.fire(laptop, 'submit', { heldDevices: 0 }, { actor: 'alice' });
    expect((await kit.can(laptop, 'approve', 'alice')).blockers[0]?.code).toBe(
      'OWN_REQUEST',
    );
    expect((await kit.can(laptop, 'withdraw', 'cathy')).blockers[0]?.code).toBe(
      'REQUESTER_ONLY',
    );
    await expect(
      kit.fire(laptop, 'reject', {}, { actor: 'cathy' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await kit.fire(
      laptop,
      'approve',
      { decisionComment: 'OK' },
      { actor: 'cathy' },
    );
    await kit.fire(laptop, 'issue', { deviceId: 'device-1' }, { actor: 'ben' });
    expect(kit.get(laptop)).toMatchObject({
      status: 'issued',
      decidedById: 'cathy',
      issuedById: 'ben',
    });
    expect(await kit.history(laptop)).toEqual([
      '$create',
      'submit',
      'approve',
      'issue',
    ]);
    expect(sent).toEqual([
      'assetManagers:approvalRequested',
      'requester:approved',
      'itSupport:readyToIssue',
      'requester:issued',
    ]);
  });
});
