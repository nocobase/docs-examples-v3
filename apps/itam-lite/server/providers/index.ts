import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';
import DevicesProvider from './devices.js';
import SubmissionProvider from './submission.js';
import RequestsProvider from './requests.js';
import WorkflowManagementProvider from './workflow-management.js';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  SubmissionProvider,
  DevicesProvider,
  RequestsProvider,
  WorkflowManagementProvider,
];

export default serviceProviders;
