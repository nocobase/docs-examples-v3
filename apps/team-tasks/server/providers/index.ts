import ProjectsProvider from './projects.js';
import TasksProvider from './tasks.js';
import SubmissionProvider from './submission.js';
import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  SubmissionProvider,
  TasksProvider,
  ProjectsProvider,
];

export default serviceProviders;
