import { Analytics } from "@vercel/analytics/react";

import { sanitizeVercelAnalyticsEvent } from "./vercel-analytics";

export function VercelWebAnalytics() {
  return <Analytics beforeSend={sanitizeVercelAnalyticsEvent} />;
}
