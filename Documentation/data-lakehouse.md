# Savr Data Lakehouse Layer

## Purpose

The project design includes a data lakehouse layer for storing user activity such as recipe views, searches, ratings, saves, follows, and other engagement events. This implementation provides a simplified local prototype of that layer using the current Express and SQLite stack.

The goal is to capture analytics events separately from core operational tables so the system can later support reporting, trend analysis, recommendations, and creator engagement metrics.

## Current Implementation

The lakehouse prototype is implemented through:

- `ActivityEvents` table in the SQLite database
- backend activity logging helper in `Codebase/backend/lakehouse.js`
- analytics API endpoints in `Codebase/backend/index.js`
- frontend analytics helper in `Codebase/frontend/src/lib/activity.js`
- analytics dashboard page at `/analytics`

## Event Table

`ActivityEvents` stores append-only usage events.

Important fields:

- `Users_idUsers`: optional user id when the event is tied to a logged-in user
- `username`: optional username snapshot for easier reporting
- `event_type`: event name such as `click`, `login`, `register`, `page_view`, `recipe_view`, `search`, or `rating_submit`
- `entity_type`: object type the event relates to, such as `page`, `recipe`, or `user`
- `entity_id`: id or slug for the entity
- `event_value`: optional numeric value, such as a rating score
- `metadata_json`: flexible JSON string for extra context
- `source`: event source, currently `web`
- `created_at`: event timestamp stored by SQLite; the frontend dashboard formats it as Toronto time

In the dashboard, `entity_type` and `entity_id` are shown as the tracked page or item. For example, a page-view event for the analytics page is stored as `entity_type = page`, `entity_id = analytics`, with `metadata_json.path = /analytics`. Navigation clicks are stored as `event_type = click`, with metadata describing the link label and destination path.

## Backend Endpoints

### Log Activity

```http
POST /activity
Content-Type: application/json
```

Example:

```json
{
  "userId": 1,
  "username": "demo",
  "eventType": "recipe_view",
  "entityType": "recipe",
  "entityId": "12",
  "metadata": {
    "path": "/recipe/12"
  }
}
```

### Analytics Summary

```http
GET /analytics/summary
```

Returns total events, unique actors, events grouped by type, daily recent counts, and top entities.

### Recent Events

```http
GET /analytics/events?limit=25
```

Returns the most recent activity events.

### Trending Entities

```http
GET /analytics/trending?days=7&limit=10
```

Returns entities with the highest activity counts within a recent time window.

## Frontend Usage

The frontend uses `trackActivity()` from `Codebase/frontend/src/lib/activity.js`.

Example:

```js
trackActivity({
  eventType: "page_view",
  entityType: "page",
  entityId: "home",
  metadata: { path: "/home" },
});
```

The `/analytics` route displays a simple dashboard for the stored event data.

## Future Extensions

The current prototype keeps analytics in SQLite for course-project simplicity. A fuller lakehouse layer could later move events into a separate analytics database or object-storage-backed lakehouse. Useful future additions include:

- recipe view tracking when recipe detail pages are implemented
- search query tracking when search is implemented
- rating, comment, save, and follow event logging from their services
- scheduled aggregation tables for trending recipes
- export jobs for CSV, Parquet, or cloud storage
- dashboards for creator statistics and user engagement
