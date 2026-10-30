import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { ProjectService } from '../projects/service.js';
import { projectPermissions, label } from '../projects/permissions.js';
export const projectServiceToken = createServiceToken<ProjectService>(
  'team-tasks/projects',
);
export default class ProjectsProvider extends ServiceProvider<Application> {
  readonly name = 'team-tasks/projects';
  override async boot() {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({ name: 'projects', title: label('title') });
    authz.ui.sections.add({
      name: 'projects',
      parent: 'business',
      title: label('title'),
    });
    authz.ui.place(authz.compositeResources.define(projectPermissions), {
      section: 'projects',
    });
    this.app.container.instance(
      projectServiceToken,
      new ProjectService(this.app.container.resolve(databaseManagerToken)),
    );
  }
}
