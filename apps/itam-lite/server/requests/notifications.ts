import type { ServiceContainer } from '@nocobase/service-provider';
import { notificationServiceToken } from '@nocobase/app-plugin-notification/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { i18nToken } from '@nocobase/app-server/i18n';
import metadata from '../../package.json' with { type: 'json' };
import type { RequestNotifications } from './lifecycle.js';

/** The permission sets whose holders are told about requests (database/main/seeds/202610300202_itam_roles.ts). */
export const ROLE_KEYS = {
  assetManagers: 'asset-manager',
  itSupport: 'it-support',
} as const;

/**
 * In-app messages through the notification plugin. Recipients are the holders of a role, or the requester; the
 * requester never receives the role messages about their own request. Delivery failures throw, so the lifecycle effect
 * retries them and keeps the failure visible in workflow management; the plugin deduplicates by idempotency key.
 * Messages use the deployment's default language: the server keeps no per-person language for background work.
 */
export function createRequestNotifications(
  container: ServiceContainer,
): RequestNotifications {
  return {
    async notify({ key, to, record, message }) {
      if (!container.has(notificationServiceToken)) return;
      let recipients: string[];
      if (to === 'requester') recipients = [record.requesterId];
      else {
        const assignments = await container
          .resolve(authorizationToken)
          .permissionSets.listAssignments(ROLE_KEYS[to]);
        recipients = [
          ...new Set(
            assignments
              .filter((assignment) => assignment.subject.type === 'user')
              .map((assignment) => String(assignment.subject.id)),
          ),
        ].filter((id) => id !== record.requesterId);
      }
      if (!recipients.length) return;
      const t = container.has(i18nToken)
        ? container.resolve(i18nToken).getFixedT(metadata.name)
        : (text: string) => text;
      const params = {
        requestNo: record.requestNo,
        comment: record.decisionComment,
      };
      await container.resolve(notificationServiceToken).send({
        idempotencyKey: `${key}:${to}`,
        source: { type: 'deviceRequest', referenceId: String(record.id) },
        messages: {
          // The `inbox` channel (type in-app) from config.example.yml's notification.channels.
          inbox: {
            to: recipients,
            title: t(`notifications.${message}.title`, params),
            body: t(`notifications.${message}.body`, params),
            target: { type: 'route', path: `/requests/${String(record.id)}` },
          },
        },
      });
    },
  };
}
