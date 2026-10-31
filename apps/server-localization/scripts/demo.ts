import { createApp } from "../server/app.js";
import { reportMessageToken } from "../server/services/report-message.js";

const [scenario = "request", locale = "zh-CN", name = "Q3"] =
  process.argv.slice(2);
const app = await createApp();
try {
  const request = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://example.test/api/${path}`, init));
  if (scenario === "background") {
    console.log(
      JSON.stringify(
        await app.container.resolve(reportMessageToken).render(locale, name),
        null,
        2,
      ),
    );
  } else if (scenario === "concurrent") {
    const service = app.container.resolve(reportMessageToken);
    console.log(
      JSON.stringify(
        await Promise.all(
          ["en-US", "zh-CN", "fr-FR"].map((language) =>
            service.render(language, name),
          ),
        ),
        null,
        2,
      ),
    );
  } else if (["request", "session", "override", "error"].includes(scenario)) {
    const headers = new Headers({ "Accept-Language": locale });
    if (scenario === "session") {
      const saved = await request("demo-locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "en-US" }),
      });
      if (!saved.ok) throw new Error(await saved.text());
      headers.set(
        "Cookie",
        saved.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; "),
      );
    }
    const path =
      scenario === "override"
        ? "report-delivery-preview"
        : scenario === "error"
          ? "report-not-ready"
          : "report-message-preview";
    const response = await request(`${path}?${new URLSearchParams({ name })}`, {
      headers,
    });
    console.log(`HTTP ${response.status}`);
    console.log(JSON.stringify(await response.json(), null, 2));
    if (response.status !== (scenario === "error" ? 400 : 200))
      throw new Error("Unexpected response status");
  } else {
    throw new Error(
      "Use request, session, background, concurrent, override or error.",
    );
  }
} finally {
  await app.shutdown();
}
