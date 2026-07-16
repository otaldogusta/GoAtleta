/**
 * securityLogger — structured security event logger for Edge Functions.
 *
 * Design goals:
 *   - Decoupled from console.*: callers import this helper, not console directly.
 *   - Future-ready: swap the sink (Sentry, OpenTelemetry, Datadog) in one place.
 *   - Privacy-aware: hostname logging is configurable per environment.
 *
 * Hostname privacy note:
 *   By default, hostnames are logged as plain text. This is generally acceptable when
 *   the hostname comes from the server's own DNS validation step (not raw user input),
 *   and when logs are restricted to internal infrastructure.
 *   However, depending on your privacy policy, you may prefer to:
 *     - 'hash'  → log only the first 16 hex chars of SHA-256(hostname) — searchable
 *                 in logs but not directly human-readable.
 *     - 'omit'  → do not log the hostname at all.
 *   Set the policy once at startup via `securityLogger.setHostnamePolicy(...)`.
 *
 * Usage:
 *   import { securityLogger } from "../_shared/security-logger.ts";
 *   securityLogger.warn("ssrf_blocked", { reason: "private_ip", hostname, userId });
 */

export type SecurityEventName =
  | "ssrf_blocked"
  | "ssrf_allowed"
  | "dns_fail"
  | "redirect_blocked"
  | "rate_limit_exceeded"
  | "auth_rejected";

export type HostnamePolicy = "plain" | "hash" | "omit";

export type SecurityLogPayload = {
  /** The securityLogger event name (used as a metric key). */
  event: SecurityEventName;
  /** Human-readable reason for the event. */
  reason?: string;
  /** Hostname field — actual value depends on hostnamePolicy setting. */
  hostname?: string;
  /** Hashed or partial user identifier — avoid raw UUIDs in prod logs. */
  userId?: string;
  /** Extra structured fields; keep them serialisable. */
  [key: string]: unknown;
};

type LogSink = (level: "warn" | "error" | "info", payload: SecurityLogPayload) => void;

/**
 * Default sink: structured JSON to stderr.
 * Replace with Sentry/OTel export by calling `securityLogger.setSink(...)`.
 */
const defaultSink: LogSink = (level, payload) => {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...payload });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

let _sink: LogSink = defaultSink;
let _hostnamePolicy: HostnamePolicy = "plain";

/**
 * Hashes a hostname to the first 16 hex chars of its SHA-256 digest.
 * 16 chars = 64 bits of the hash — enough to correlate log entries
 * without exposing the actual hostname in plain text.
 */
const hashHostname = async (hostname: string): Promise<string> => {
  try {
    const encoded = new TextEncoder().encode(hostname);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  } catch {
    return "(hash-error)";
  }
};

const applyHostnamePolicy = async (
  payload: Omit<SecurityLogPayload, "event">
): Promise<Omit<SecurityLogPayload, "event">> => {
  const hostname =
    typeof payload.hostname === "string" ? payload.hostname : "";
  if (!hostname || _hostnamePolicy === "plain") return payload;
  if (_hostnamePolicy === "omit") {
    const { hostname: _dropped, ...rest } = payload;
    return rest;
  }
  // "hash" mode
  return { ...payload, hostname: `sha256:${await hashHostname(hostname)}` };
};

export const securityLogger = {
  /**
   * Replace the log sink at runtime (e.g., inject Sentry, OTel, Datadog).
   * Call this once at function startup.
   */
  setSink(sink: LogSink) {
    _sink = sink;
  },

  /**
   * Set the hostname logging policy.
   *   'plain' (default) — log hostname as-is. Acceptable when logs are internal
   *                        and the hostname derives from server DNS, not raw user input.
   *   'hash'            — log SHA-256(hostname)[0:16] hex. Correlatable but opaque.
   *   'omit'            — drop the hostname field entirely.
   */
  setHostnamePolicy(policy: HostnamePolicy) {
    _hostnamePolicy = policy;
  },

  async warn(event: SecurityEventName, payload: Omit<SecurityLogPayload, "event">) {
    _sink("warn", { event, ...(await applyHostnamePolicy(payload)) });
  },

  async error(event: SecurityEventName, payload: Omit<SecurityLogPayload, "event">) {
    _sink("error", { event, ...(await applyHostnamePolicy(payload)) });
  },

  async info(event: SecurityEventName, payload: Omit<SecurityLogPayload, "event">) {
    _sink("info", { event, ...(await applyHostnamePolicy(payload)) });
  },
};

