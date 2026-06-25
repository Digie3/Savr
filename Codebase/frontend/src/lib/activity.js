const API_BASE_URL = "http://localhost:4000";
const VISITOR_KEY = "savrVisitorId";

export function getVisitorId() {
  const existingVisitorId = localStorage.getItem(VISITOR_KEY);

  if (existingVisitorId) return existingVisitorId;

  const visitorId = `visitor-${crypto.randomUUID().slice(0, 8)}`;
  localStorage.setItem(VISITOR_KEY, visitorId);

  return visitorId;
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("savrUser"));
  } catch {
    return null;
  }
}

export async function trackActivity(event) {
  const user = getStoredUser();
  const visitorId = getVisitorId();

  const payload = {
    ...event,
    userId: event.userId || user?.id,
    username: event.username || user?.username || visitorId,
    source: "web",
  };

  try {
    await fetch(`${API_BASE_URL}/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Analytics should never block the user-facing workflow.
  }
}

export async function fetchAnalyticsSummary() {
  const response = await fetch(`${API_BASE_URL}/analytics/summary`);

  if (!response.ok) {
    throw new Error("Unable to load analytics summary");
  }

  return response.json();
}

export async function fetchRecentEvents(limit = 20) {
  const response = await fetch(`${API_BASE_URL}/analytics/events?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Unable to load activity events");
  }

  return response.json();
}
