import type { Application } from '@nocobase/app-server/application';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { OrderAccessDenied } from './permissions.js';

// Local commands select an existing user explicitly. Jobs recheck that user at execution time.
// This sample assigns business roles directly to users; it does not model group membership.
export async function actorContext(app: Application, userId: string) {
  const user = await app.container
    .resolve(userAdministrationServiceToken)
    .get(userId);
  if (!user || user.disabledAt || user.kind !== 'person')
    throw new OrderAccessDenied('The actor is unavailable.');
  return app.container
    .resolve(authorizationToken)
    .for({ principal: { type: 'user', id: user.id } });
}
