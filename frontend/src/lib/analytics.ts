import { API_BASE_URL } from './constants';

/** Fire-and-forget analytics event — never blocks or breaks the UI. */
export function trackEvent(type: string, properties: Record<string, unknown> = {}): void {
  try {
    void fetch(`${API_BASE_URL}/api/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, properties }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // never let analytics break the app
  }
}
