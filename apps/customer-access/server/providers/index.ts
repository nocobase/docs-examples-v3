import CustomerAccessProvider from './customer-access.js';
import SubmissionProvider from './submission.js';
import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  CustomerAccessProvider,
  SubmissionProvider,
];

export default serviceProviders;
