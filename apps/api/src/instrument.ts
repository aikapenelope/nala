/**
 * Error tracking instrumentation via Sentry SDK → Bugsink.
 *
 * Bugsink is a lightweight, self-hosted error tracking service that is
 * fully compatible with the Sentry SDK. Errors, breadcrumbs, and context
 * are sent to our Observability Plane (obs-plane-dev:8000) over the
 * private network.
 *
 * This file MUST be imported at the very top of the entry point (index.ts)
 * before any other imports, so that Sentry can instrument all modules.
 *
 * Configuration:
 *   BUGSINK_DSN - Sentry-compatible DSN pointing to Bugsink
 *                 (e.g., http://<key>@obs-plane-dev:8000/<project_id>)
 *
 * When BUGSINK_DSN is not set, this module does nothing (safe for dev).
 */

import * as Sentry from "@sentry/node";

const dsn = process.env.BUGSINK_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.APP_VERSION ?? "unknown",

    // Sample 10% of requests for performance traces.
    // Bugsink supports traces but they're optional.
    tracesSampleRate: 0.1,

    // Strip sensitive headers before sending to Bugsink.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  console.log("[sentry] Error tracking enabled (Bugsink).");
} else {
  console.warn("[sentry] BUGSINK_DSN not set. Error tracking disabled.");
}

export { Sentry };
