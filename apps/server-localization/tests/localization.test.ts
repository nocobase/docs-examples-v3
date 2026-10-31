import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Hono } from "hono";
import { I18nRuntime } from "@nocobase/i18n";
import { getRequestTranslator } from "@nocobase/i18n/server";
import { i18nToken } from "@nocobase/app-server/i18n";
import { createApp } from "../server/app.js";
import { reportMessageToken } from "../server/services/report-message.js";

async function setup(t: TestContext, defaultLocale = "en-US") {
  const app = await createApp(defaultLocale);
  t.after(() => app.shutdown());
  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://example.test/api/${path}`, init));
  const preview = async (
    locale?: string,
    cookie?: string,
    path = "report-message-preview?name=Q3",
  ) => {
    const headers = new Headers();
    if (locale) headers.set("Accept-Language", locale);
    if (cookie) headers.set("Cookie", cookie);
    const response = await request(path, { headers });
    return { status: response.status, body: await response.json() };
  };
  return { app, request, preview };
}

test("real request middleware renders English and Chinese and negotiates header preferences", async (t) => {
  const { preview } = await setup(t);
  assert.deepEqual((await preview("en-US")).body.data, {
    locale: "en-US",
    message: "Report Q3 is ready.",
  });
  assert.deepEqual((await preview("zh-CN")).body.data, {
    locale: "zh-CN",
    message: "报表 Q3 已准备好。",
  });
  assert.equal(
    (await preview("en-US;q=0.3, zh-CN;q=0.9")).body.data.locale,
    "zh-CN",
  );
  assert.equal((await preview("fr-FR, zh-CN;q=0.8")).body.data.locale, "zh-CN");
});

test("unsupported and absent language use the configured default; a plugin adds no offered languages", async (t) => {
  const { app, preview } = await setup(t, "zh-CN");
  assert.equal(
    (await preview("fr-FR")).body.data.message,
    "报表 Q3 已准备好。",
  );
  assert.equal((await preview()).body.data.locale, "zh-CN");
  assert.equal((await preview("ja-JP")).body.data.locale, "zh-CN");
  assert.deepEqual(app.container.resolve(i18nToken).getLocales(), [
    "en-US",
    "zh-CN",
  ]);
});

test("a real session cookie overrides the header without changing another visitor", async (t) => {
  const { request, preview } = await setup(t);
  const saved = await request("demo-locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "en-US" }),
  });
  assert.equal(saved.status, 200);
  const cookie = saved.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  assert.equal((await preview("zh-CN", cookie)).body.data.locale, "en-US");
  assert.equal((await preview("zh-CN")).body.data.locale, "zh-CN");
  const invalid = await request("demo-locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "fr-FR" }),
  });
  assert.equal(invalid.status, 400);
});

test("background rendering loads a cold locale and keeps concurrent recipients and requests isolated", async (t) => {
  const { app, preview } = await setup(t);
  const runtime = app.container.resolve(i18nToken);
  assert.equal(
    runtime.i18n.hasResourceBundle("zh-CN", "server-localization"),
    false,
  );
  const service = app.container.resolve(reportMessageToken);
  const expected = {
    "en-US": "Report Q3 is ready.",
    "zh-CN": "报表 Q3 已准备好。",
    "fr-FR": "Report Q3 is ready.",
  };
  await Promise.all(
    Array.from({ length: 30 }, async (_, index) => {
      const locale = (["en-US", "zh-CN", "fr-FR"] as const)[index % 3];
      const [message, response] = await Promise.all([
        service.render(locale, "Q3"),
        preview(locale),
      ]);
      assert.equal(message.message, expected[locale]);
      assert.equal(response.body.data.message, expected[locale]);
      assert.equal(message.locale, locale === "fr-FR" ? "en-US" : locale);
    }),
  );
  assert.equal(runtime.getLocale(), "en-US");
  assert.equal((await service.render("zh-CN", "Q3")).subject, "你的报表：Q3");
});

test("application overrides replace plugin wording while unmodified plugin keys still work", async (t) => {
  const { preview } = await setup(t);
  assert.deepEqual(
    (await preview("en-US", undefined, "report-delivery-preview?name=Q3")).body
      .data,
    {
      locale: "en-US",
      message: "Your report Q3 is available in the customer portal.",
      channel: "Customer portal",
    },
  );
  assert.deepEqual(
    (await preview("zh-CN", undefined, "report-delivery-preview?name=Q3")).body
      .data,
    {
      locale: "zh-CN",
      message: "报表 Q3 已可在客户门户中查看。",
      channel: "客户门户",
    },
  );
});

test("localized errors preserve HTTP status, reason, domain and developer message", async (t) => {
  const { preview } = await setup(t);
  const english = await preview("en-US", undefined, "report-not-ready?name=Q3");
  const chinese = await preview("zh-CN", undefined, "report-not-ready?name=Q3");
  for (const { status, body } of [english, chinese]) {
    assert.equal(status, 400);
    assert.equal(body.error.status, "FAILED_PRECONDITION");
    assert.equal(body.error.reason, "REPORT_NOT_READY");
    assert.equal(body.error.domain, "reports");
    assert.equal(body.error.message, "The requested report is not ready.");
  }
  assert.deepEqual(english.body.error.localizedMessage, {
    locale: "en-US",
    message: "Report Q3 is not ready yet.",
  });
  assert.deepEqual(chinese.body.error.localizedMessage, {
    locale: "zh-CN",
    message: "报表 Q3 尚未准备好。",
  });
});

test("invalid report names return validation errors before translating", async (t) => {
  const { preview } = await setup(t);
  for (const query of [
    "",
    "?name=",
    `?name=${"x".repeat(81)}`,
    "?name=Q3&unexpected=1",
  ]) {
    const { status, body } = await preview(
      "zh-CN",
      undefined,
      `report-message-preview${query}`,
    );
    assert.equal(status, 400);
    assert.equal(body.error.reason, "INVALID_INPUT");
  }
});

test("missing request middleware is an integration error, not a translation fallback", async () => {
  const router = new Hono();
  router.get("/", (c) => {
    assert.throws(
      () => getRequestTranslator(c),
      /Request translator is unavailable/,
    );
    return c.text("checked");
  });
  assert.equal(
    await (await router.request("http://example.test/")).text(),
    "checked",
  );
});

test("an isolated incomplete resource falls back to the default wording, then the key", async () => {
  const runtime = new I18nRuntime({ defaultLocale: "en-US" });
  runtime.registerApplicationNamespace("fallback-fixture", {
    "en-US": async () => ({ default: { ready: "Ready" } }),
    "zh-CN": async () => ({ default: {} }),
  });
  await runtime.init();
  await runtime.ensureLocaleLoaded("zh-CN");
  const t = runtime.getFixedT("fallback-fixture", "zh-CN");
  assert.equal(t("ready"), "Ready");
  assert.equal(t("missing"), "missing");
});
