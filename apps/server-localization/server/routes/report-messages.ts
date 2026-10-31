import { Hono } from "hono";
import { z } from "zod";
import {
  ApiError,
  apiErrorHandler,
  apiValidator,
  defineApiRoutes,
  describeRoute,
  dataResponse,
  apiErrorResponses,
} from "@nocobase/app-server/router";
import {
  getRequestTranslator,
  getRequestLocale,
  getContextSession,
} from "@nocobase/i18n/server";

const nameQuery = z.strictObject({ name: z.string().trim().min(1).max(80) });
const message = z.object({ locale: z.string(), message: z.string() });

export default defineApiRoutes(() => {
  const router = new Hono();
  router.onError(apiErrorHandler);
  router.get(
    "/report-message-preview",
    describeRoute({
      operationId: "previewReportMessage",
      summary: "Preview report wording",
      security: [],
      responses: { 200: dataResponse(message), ...apiErrorResponses },
    }),
    apiValidator("query", nameQuery),
    (c) =>
      c.json({
        data: {
          locale: getRequestLocale(c),
          message: getRequestTranslator(c)("reports.ready", {
            name: c.req.valid("query").name,
          }),
        },
      }),
  );
  router.get(
    "/report-delivery-preview",
    describeRoute({
      operationId: "previewDelivery",
      summary: "Preview overridden plugin wording",
      security: [],
      responses: {
        200: dataResponse(message.extend({ channel: z.string() })),
        ...apiErrorResponses,
      },
    }),
    apiValidator("query", nameQuery),
    (c) => {
      const t = getRequestTranslator(c, "@example/report-delivery");
      return c.json({
        data: {
          locale: getRequestLocale(c),
          message: t("delivery.ready", { name: c.req.valid("query").name }),
          channel: t("delivery.channel"),
        },
      });
    },
  );
  router.get(
    "/report-not-ready",
    describeRoute({
      operationId: "previewReportError",
      summary: "Preview a report-not-ready error",
      security: [],
      responses: { ...apiErrorResponses },
    }),
    apiValidator("query", nameQuery),
    (c) => {
      throw new ApiError({
        status: "FAILED_PRECONDITION",
        reason: "REPORT_NOT_READY",
        domain: "reports",
        message: "The requested report is not ready.",
        localizedMessage: {
          locale: getRequestLocale(c)!,
          message: getRequestTranslator(c)("reports.notReady", {
            name: c.req.valid("query").name,
          }),
        },
      });
    },
  );
  // Demo-only preference endpoint. It changes only this caller's in-memory session.
  router.post(
    "/demo-locale",
    describeRoute({
      operationId: "setDemoLocale",
      summary: "Set a demonstration session preference",
      security: [],
      responses: {
        200: dataResponse(z.object({ locale: z.enum(["en-US", "zh-CN"]) })),
        ...apiErrorResponses,
      },
    }),
    apiValidator(
      "json",
      z.strictObject({ locale: z.enum(["en-US", "zh-CN"]) }),
    ),
    async (c) => {
      const { locale } = c.req.valid("json");
      const session = getContextSession(c);
      if (!session) throw new Error("Session middleware is required.");
      await session.set("locale", locale);
      return c.json({ data: { locale } });
    },
  );
  return router;
});
