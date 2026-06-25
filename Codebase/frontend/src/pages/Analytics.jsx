import { useEffect, useRef, useState } from "react";

import {
  fetchAnalyticsSummary,
  fetchRecentEvents,
  trackActivity,
} from "../lib/activity";

const TORONTO_TIME_ZONE = "America/Toronto";

function parseMetadata(metadataJson) {
  if (!metadataJson) return {};

  try {
    return JSON.parse(metadataJson);
  } catch {
    return {};
  }
}

function formatEventTime(value) {
  if (!value) return "None yet";

  const utcDate = new Date(`${value.replace(" ", "T")}Z`);

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TORONTO_TIME_ZONE,
    timeZoneName: "short",
  }).format(utcDate);
}

function formatEventType(type) {
  const labels = {
    click: "Click",
    page_view: "Page view",
    register: "Registration",
    login: "Login",
    logout: "Logout",
    recipe_view: "Recipe view",
    recipe_create: "Recipe created",
    recipe_save: "Recipe saved",
    recipe_unsave: "Recipe unsaved",
    comment_create: "Comment added",
    rating_submit: "Rating submitted",
    follow: "Follow",
    unfollow: "Unfollow",
    search: "Search",
  };

  return labels[type] || type.replaceAll("_", " ");
}

function describeTrackedItem(item) {
  if (!item?.entityType && !item?.entityId) return "No tracked item";

  if (item.entityType === "page") return `Page: /${item.entityId}`;
  if (item.entityType === "search") return `Search: ${item.entityId}`;
  if (item.entityType === "recipe") return `Recipe: ${item.entityId}`;
  if (item.entityType === "user") return `User: ${item.entityId}`;

  return `${item.entityType}: ${item.entityId}`;
}

function describeEventTarget(event) {
  const metadata = parseMetadata(event.metadataJson);

  if (event.eventType === "click") {
    const label = metadata.label || event.entityId || "item";
    const path = metadata.path ? ` -> ${metadata.path}` : "";

    return `Clicked ${label}${path}`;
  }

  if (event.eventType === "page_view" && metadata.path) {
    return `Opened ${metadata.path}`;
  }

  if (event.eventType === "login") return `Signed in as ${event.username}`;
  if (event.eventType === "register") return `Created account ${event.username}`;

  if (metadata.query) return `Searched for "${metadata.query}"`;
  if (event.entityType === "page" && event.entityId) return `/${event.entityId}`;
  if (event.entityType && event.entityId) return `${event.entityType}: ${event.entityId}`;

  return "No target";
}

function Analytics() {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    async function loadAnalytics() {
      try {
        await trackActivity({
          eventType: "page_view",
          entityType: "page",
          entityId: "analytics",
          metadata: { path: "/analytics" },
        });

        const [summaryData, eventData] = await Promise.all([
          fetchAnalyticsSummary(),
          fetchRecentEvents(15),
        ]);

        setSummary(summaryData);
        setEvents(eventData.events || []);
      } catch (err) {
        setError(err.message);
      }
    }

    loadAnalytics();
  }, []);

  return (
    <main className="analytics-page">
      <section className="analytics-header">
        <div>
          <p className="badge">Data Lakehouse</p>
          <h1>Activity Analytics</h1>
          <p>
            Prototype event layer for tracking product usage, recipe engagement,
            and future recommendation signals.
          </p>
        </div>
      </section>

      {error && <p className="error-message">{error}</p>}

      <section className="metric-grid">
        <article className="metric-card">
          <span>Total Events</span>
          <strong>{summary?.totalEvents ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Unique Actors</span>
          <strong>{summary?.uniqueActors ?? 0}</strong>
        </article>
        <article className="metric-card">
          <span>Last Event (Toronto)</span>
          <strong>{formatEventTime(summary?.lastEventAt)}</strong>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="analytics-panel">
          <h2>Events by Type</h2>
          <div className="event-list">
            {(summary?.byType || []).map((item) => (
              <div className="event-row" key={item.eventType}>
                <span>{formatEventType(item.eventType)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {summary?.byType?.length === 0 && <p>No activity logged yet.</p>}
          </div>
        </article>

        <article className="analytics-panel">
          <h2>Most Tracked Pages & Items</h2>
          <div className="event-list">
            {(summary?.topEntities || []).map((item) => (
              <div
                className="event-row"
                key={`${item.entityType}-${item.entityId}`}
              >
                <span>{describeTrackedItem(item)}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {summary?.topEntities?.length === 0 && (
              <p>No tracked pages or items yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="analytics-panel">
        <h2>Actors Counted</h2>
        <div className="event-list">
          {(summary?.actors || []).map((actor) => (
            <div className="event-row" key={actor.actor}>
              <span>{actor.actor}</span>
              <strong>{actor.count} events</strong>
            </div>
          ))}
          {summary?.actors?.length === 0 && <p>No actors recorded yet.</p>}
        </div>
      </section>

      <section className="analytics-panel">
        <h2>Recent Activity</h2>
        <div className="activity-table">
          <div className="activity-table-header">
            <span>Event</span>
            <span>Actor</span>
            <span>Activity Detail</span>
            <span>Toronto Time</span>
          </div>
          {events.map((event) => (
            <div className="activity-table-row" key={event.id}>
              <span>{formatEventType(event.eventType)}</span>
              <span>{event.username || event.userId || "anonymous"}</span>
              <span>{describeEventTarget(event)}</span>
              <span>{formatEventTime(event.createdAt)}</span>
            </div>
          ))}
          {events.length === 0 && <p>No events recorded yet.</p>}
        </div>
      </section>
    </main>
  );
}

export default Analytics;
