import type { PagePermissionTitles } from './page-permissions.js';

/** Permission labels for application pages without navigation/breadcrumb titles (including overlays).
 * Keys are existing route names; values are application translation keys.
 * Do not add navigation/breadcrumbs or change authorization ids just to name a permission.
 */
export const pagePermissionTitles: PagePermissionTitles = {
  deviceCreate: 'devices.new',
  deviceEdit: 'devices.edit',
  requestCreate: 'requests.new',
  requestDetail: 'requests.title',
  workflowDefinitions: 'workflows.definitions',
  workflowDefinition: 'workflows.definitions',
  workflowExecutions: 'workflows.executions',
  workflowExecution: 'workflows.executions',
};
