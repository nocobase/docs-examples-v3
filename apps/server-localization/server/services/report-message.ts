import metadata from "../../package.json" with { type: "json" };
import type { I18nRuntime } from "@nocobase/i18n";
import { createServiceToken } from "@nocobase/service-provider";

export class ReportMessageService {
  constructor(private readonly i18n: I18nRuntime) {}

  async render(recipientLocale: string, name: string) {
    const locale = this.i18n.resolveLocale(recipientLocale);
    await this.i18n.ensureLocaleLoaded(locale);
    const t = this.i18n.getFixedT(metadata.name, locale);
    return {
      locale,
      subject: t("reports.subject", { name }),
      message: t("reports.ready", { name }),
    };
  }
}
export const reportMessageToken =
  createServiceToken<ReportMessageService>("report-message");
