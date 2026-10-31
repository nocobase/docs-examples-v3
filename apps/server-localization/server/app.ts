import { Application } from "@nocobase/app-server/application";
import { AppConfig, createAppPaths } from "@nocobase/app-server/config";
import { I18nProvider, i18nHttpMiddleware } from "@nocobase/app-server/i18n";
import {
  SessionProvider,
  sessionHttpMiddleware,
} from "@nocobase/app-server/session";
import metadata from "../package.json" with { type: "json" };
import locales from "./locales/index.js";
import { reportDelivery } from "./report-delivery.js";
import ReportMessageProvider from "./providers/report-message.js";
import routes from "./routes/report-messages.js";

export async function createApp(defaultLocale = "en-US") {
  const config = new AppConfig();
  await config.loadAll();
  config.mergeDefaults({
    app: {
      name: metadata.name,
      publicBasePath: "",
      internalBasePath: "",
      publicApiUrl: "/api",
    },
    i18n: { defaultLocale },
    session: {
      default: "memory",
      stores: { memory: { driver: "memory" } },
      cookie: {
        name: "report_locale",
        path: "/",
        secure: false,
        httpOnly: true,
        sameSite: "lax",
      },
      lifetime: { absolute: "2h" },
      gcLottery: { hits: 0, total: 100 },
    },
  });
  const app = new Application({
    config,
    paths: createAppPaths({ rootDir: import.meta.dirname }),
    nodeEnv: "development",
  });
  app.addServiceProvider(I18nProvider);
  app.addServiceProvider(SessionProvider);
  app.addHttpMiddleware(sessionHttpMiddleware);
  app.addHttpMiddleware(i18nHttpMiddleware);
  app.addRuntimeContributions({
    plugins: {
      appPackageName: metadata.name,
      plugins: [
        {
          definition: reportDelivery,
          metadata: {
            packageName: reportDelivery.packageName,
            version: "1.0.0",
            rootDir: import.meta.dirname,
            baseDir: import.meta.dirname,
            jobLocations: [],
          },
        },
      ],
    },
    locales,
    serviceProviders: [ReportMessageProvider],
    routes: [routes],
  });
  try {
    await app.start();
    return app;
  } catch (error) {
    await app.shutdown();
    throw error;
  }
}
