import type { Application } from "@nocobase/app-server/application";
import { i18nToken } from "@nocobase/app-server/i18n";
import { ServiceProvider } from "@nocobase/service-provider";
import {
  ReportMessageService,
  reportMessageToken,
} from "../services/report-message.js";

export default class ReportMessageProvider extends ServiceProvider<Application> {
  readonly name = "report-message";
  override register() {
    this.app.container.singleton(
      reportMessageToken,
      (container) => new ReportMessageService(container.resolve(i18nToken)),
    );
  }
}
