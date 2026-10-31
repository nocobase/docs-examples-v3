import { Application } from "@nocobase/app-server/application";
import { AppConfig, createAppPaths } from "@nocobase/app-server/config";
import { JobExecutorServiceProvider } from "@nocobase/app-server/jobs";
import { jobs, type ReportsConfig } from "./config.js";
import ReportsProvider from "./providers/reports.js";

/** An actual NocoBase App with no database, HTTP listener or browser client. */
export async function createApp(
  rootDir: string,
  reports: ReportsConfig = { consume: true },
) {
  const config = new AppConfig();
  await config.loadAll();
  config.mergeDefaults({
    app: { name: "background-tasks", publicBasePath: "" },
    jobs,
    reports,
  });
  const app = new Application({
    config,
    paths: createAppPaths({ rootDir }),
    nodeEnv: "development",
  });
  app.addServiceProvider(JobExecutorServiceProvider);
  app.addServiceProvider(ReportsProvider);
  try {
    await app.start();
    return app;
  } catch (error) {
    await app.shutdown();
    throw error;
  }
}
