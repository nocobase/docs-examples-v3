import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { DeviceService } from '../devices/service.js';
import {
  assignedDevices,
  devicePermissions,
  label,
} from '../devices/permissions.js';

export const deviceServiceToken =
  createServiceToken<DeviceService>('itam-lite/devices');

export default class DevicesProvider extends ServiceProvider<Application> {
  readonly name = 'itam-lite/devices';
  override async boot() {
    // A host without the authorization plugin (the template's embedded-runtime tests) has no business permissions.
    if (!this.app.container.has(authorizationToken)) return;
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({ name: 'devices', title: label('title') });
    authz.recordAccess.define(assignedDevices);
    authz.ui.sections.add({
      name: 'devices',
      parent: 'business',
      title: label('title'),
    });
    authz.ui.place(authz.compositeResources.define(devicePermissions), {
      section: 'devices',
    });
    this.app.container.instance(
      deviceServiceToken,
      new DeviceService(
        this.app.container.resolve(databaseManagerToken),
        this.app.container.resolve(userAdministrationServiceToken),
      ),
    );
  }
}
