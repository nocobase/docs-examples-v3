import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';
import DevicesProvider from './devices.js';
import RequestsProvider from './requests.js';
import WorkflowManagementProvider from './workflow-management.js';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  DevicesProvider,
  RequestsProvider,
  WorkflowManagementProvider,
];

export default serviceProviders;
