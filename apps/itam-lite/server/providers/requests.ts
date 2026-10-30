import type { Application } from '@nocobase/app-server/application';
import { jobExecutorServiceToken } from '@nocobase/app-server/jobs';
import { loggingToken } from '@nocobase/app-server/logging';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import {
  createRepositoryLifecycleStore,
  LifecycleRuntime,
  StoredLifecycleParameters,
  type LifecycleParameterStore,
} from '@nocobase/lifecycle';
import {
  createLifecycleJobs,
  type LifecycleJobs,
} from '@nocobase/lifecycle/jobs';
import {
  createServiceToken,
  ServiceProvider,
  type ServiceToken,
} from '@nocobase/service-provider';
import metadata from '../../package.json' with { type: 'json' };
import { deviceRequestLifecycle } from '../requests/lifecycle.js';
import { createRequestNotifications } from '../requests/notifications.js';
import {
  label,
  ownRequests,
  requestPermissions,
} from '../requests/permissions.js';
import { DeviceRequestService } from '../requests/service.js';

/** The application's one lifecycle runtime; every lifecycle registers on it. */
export const lifecycleRuntimeToken: ServiceToken<LifecycleRuntime> =
  createServiceToken<LifecycleRuntime>('itam-lite/lifecycle-runtime');
export const lifecycleParametersToken: ServiceToken<LifecycleParameterStore> =
  createServiceToken<LifecycleParameterStore>('itam-lite/lifecycle-parameters');
export const requestServiceToken: ServiceToken<DeviceRequestService> =
  createServiceToken<DeviceRequestService>('itam-lite/device-requests');

/** The one scope administrator-set parameters are kept under: the whole installation. Never rename it. */
export const PARAMETER_SCOPE = 'itam-lite';
const SCOPE = metadata.name;

export default class RequestsProvider extends ServiceProvider<Application> {
  public readonly name = 'itam-lite/device-requests';
  private jobs: LifecycleJobs | undefined;
  private runtime: LifecycleRuntime | undefined;

  public override register(): void {
    this.app.container.singleton(lifecycleRuntimeToken, () =>
      this.lifecycleRuntime(),
    );
    this.app.container.singleton(
      lifecycleParametersToken,
      () =>
        new StoredLifecycleParameters(
          createRepositoryLifecycleStore(
            this.app.container.resolve(databaseManagerToken),
          ),
        ),
    );
  }

  public override async boot(): Promise<void> {
    // A host without the authorization plugin (the template's embedded-runtime tests) has no business permissions.
    if (!this.app.container.has(authorizationToken)) return;
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'deviceRequests',
      title: label('title'),
    });
    authz.recordAccess.define(ownRequests);
    authz.ui.sections.add({
      name: 'deviceRequests',
      parent: 'business',
      title: label('title'),
    });
    authz.ui.place(authz.compositeResources.define(requestPermissions), {
      section: 'deviceRequests',
    });
    this.app.container.instance(
      requestServiceToken,
      new DeviceRequestService(
        this.app.container.resolve(databaseManagerToken),
        this.app.container.resolve(userAdministrationServiceToken),
        this.app.container.resolve(lifecycleRuntimeToken),
      ),
    );
  }

  public override async start(): Promise<void> {
    // Registers the effect job, opens the executors, schedules the sweep and recovers runs an earlier process left. It
    // never stops the application starting: a database not yet migrated has no log to recover from, and the next start
    // tries again.
    try {
      await this.effectJobs().start(this.lifecycleRuntime());
    } catch (error) {
      this.app.container
        .resolve(loggingToken)
        .getLogger('lifecycle')
        .error({ err: error }, 'The lifecycle effects did not start');
    }
  }

  public override async shutdown(): Promise<void> {
    await this.jobs?.shutdown();
  }

  private effectJobs(): LifecycleJobs {
    if (this.jobs) return this.jobs;
    const executors = this.app.container.resolve(jobExecutorServiceToken);
    this.jobs = createLifecycleJobs({
      jobs: executors.getJobExecutor(SCOPE),
      schedule: executors.getScheduleExecutor(SCOPE),
      jobName: `${SCOPE}/lifecycle-effect`, // stored with every queued task: keep it stable
      sweepEveryMs: 60_000,
      onSweep: async () => {
        await this.lifecycleRuntime().prune({
          olderThan: new Date(Date.now() - 30 * 86_400_000),
        });
      },
    });
    return this.jobs;
  }

  private lifecycleRuntime(): LifecycleRuntime {
    if (this.runtime) return this.runtime;
    const logger = this.app.container
      .resolve(loggingToken)
      .getLogger('lifecycle');
    const database = this.app.container.resolve(databaseManagerToken);
    const runtime = new LifecycleRuntime({
      store: createRepositoryLifecycleStore(database),
      dispatcher: this.effectJobs(),
      logger: {
        warn: (message, details) => logger.warn({ details }, message),
        error: (message, details) => logger.error({ details }, message),
      },
    });
    runtime.register(deviceRequestLifecycle, {
      services: {
        notifications: createRequestNotifications(this.app.container),
      },
      // Workflow management → Device requests: read live on every submission.
      parameterConfiguration: {
        store: this.app.container.resolve(lifecycleParametersToken),
        scope: () => PARAMETER_SCOPE,
      },
    });
    this.runtime = runtime;
    return runtime;
  }
}
