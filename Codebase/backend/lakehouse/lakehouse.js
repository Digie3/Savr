const VALID_EVENT_TYPES = new Set([
  "register",
  "login",
  "logout",
  "click",
  "page_view",
  "recipe_view",
  "recipe_create",
  "recipe_save",
  "recipe_unsave",
  "comment_create",
  "comment_edit",
  "comment_delete",
  "rating_submit",
  "follow",
  "unfollow",
  "search",
]);

const VALID_ENTITY_TYPES = new Set([
  "app",
  "page",
  "recipe",
  "user",
  "search",
  "comment",
  "rating",
]);

export async function initLakehouse(db) {
  await db.runAsync(`PRAGMA foreign_keys = ON`);

  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS ActivityEvents (
      idActivityEvents INTEGER PRIMARY KEY AUTOINCREMENT,
      Users_idUsers INTEGER,
      username TEXT,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      event_value REAL,
      metadata_json TEXT,
      source TEXT NOT NULL DEFAULT 'web',
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (Users_idUsers) REFERENCES Users(idUsers)
    )
  `);

  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_activity_events_type
    ON ActivityEvents(event_type)
  `);

  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_activity_events_created
    ON ActivityEvents(created_at)
  `);

  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_activity_events_entity
    ON ActivityEvents(entity_type, entity_id)
  `);

  await db.runAsync(`
    CREATE INDEX IF NOT EXISTS idx_activity_events_user
    ON ActivityEvents(Users_idUsers)
  `);
}

export function normalizeActivity(input = {}) {
  const eventType = String(input.eventType || input.event_type || "").trim();
  const entityType = input.entityType || input.entity_type;
  const entityId = input.entityId || input.entity_id;
  const eventValue = input.eventValue ?? input.event_value ?? null;
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};

  if (!VALID_EVENT_TYPES.has(eventType)) {
    const allowed = Array.from(VALID_EVENT_TYPES).join(", ");
    throw new Error(`Invalid event type. Expected one of: ${allowed}`);
  }

  const normalizedEntityType = entityType ? String(entityType).trim() : null;

  if (normalizedEntityType && !VALID_ENTITY_TYPES.has(normalizedEntityType)) {
    const allowed = Array.from(VALID_ENTITY_TYPES).join(", ");
    throw new Error(`Invalid entity type. Expected one of: ${allowed}`);
  }

  return {
    userId: input.userId || input.Users_idUsers || null,
    username: input.username ? String(input.username).trim() : null,
    eventType,
    entityType: normalizedEntityType,
    entityId: entityId == null ? null : String(entityId).trim(),
    eventValue: eventValue == null || eventValue === "" ? null : Number(eventValue),
    metadata,
    source: input.source ? String(input.source).trim() : "web",
  };
}

export async function logActivity(db, input) {
  const event = normalizeActivity(input);

  if (event.eventValue !== null && Number.isNaN(event.eventValue)) {
    throw new Error("eventValue must be numeric when provided");
  }

  await db.runAsync(
    `
      INSERT INTO ActivityEvents (
        Users_idUsers,
        username,
        event_type,
        entity_type,
        entity_id,
        event_value,
        metadata_json,
        source,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      event.userId,
      event.username,
      event.eventType,
      event.entityType,
      event.entityId,
      event.eventValue,
      JSON.stringify(event.metadata),
      event.source,
    ]
  );
}

export async function getAnalyticsSummary(db) {
  const totals = await db.getAsync(`
    SELECT
      COUNT(*) AS "totalEvents",
      COUNT(DISTINCT COALESCE(CAST(Users_idUsers AS TEXT), username)) AS "uniqueActors",
      MAX(created_at) AS "lastEventAt"
    FROM ActivityEvents
  `);

  const byType = await db.allAsync(`
    SELECT event_type AS "eventType", COUNT(*) AS "count"
    FROM ActivityEvents
    GROUP BY event_type
    ORDER BY count DESC, event_type ASC
  `);

  const recentByDay = await db.allAsync(`
    SELECT date(created_at) AS "day", COUNT(*) AS "count"
    FROM ActivityEvents
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `);

  const topEntities = await db.allAsync(`
    SELECT
      entity_type AS "entityType",
      entity_id AS "entityId",
      COUNT(*) AS "count"
    FROM ActivityEvents
    WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL AND entity_id != ''
    GROUP BY entity_type, entity_id
    ORDER BY count DESC, entity_type ASC, entity_id ASC
    LIMIT 10
  `);

  const actors = await db.allAsync(`
    SELECT
      COALESCE(CAST(Users_idUsers AS TEXT), username, 'anonymous') AS "actor",
      COUNT(*) AS "count",
      MAX(created_at) AS "lastEventAt"
    FROM ActivityEvents
    GROUP BY COALESCE(CAST(Users_idUsers AS TEXT), username, 'anonymous')
    ORDER BY count DESC, actor ASC
  `);

  return {
    totalEvents: totals?.totalEvents || 0,
    uniqueActors: totals?.uniqueActors || 0,
    lastEventAt: totals?.lastEventAt || null,
    byType,
    recentByDay,
    topEntities,
    actors,
  };
}

export async function getRecentEvents(db, limit = 25) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);

  return db.allAsync(
    `
      SELECT
        idActivityEvents AS "id",
        Users_idUsers AS "userId",
        username,
        event_type AS "eventType",
        entity_type AS "entityType",
        entity_id AS "entityId",
        event_value AS "eventValue",
        metadata_json AS "metadataJson",
        source,
        created_at AS "createdAt"
      FROM ActivityEvents
      ORDER BY datetime(created_at) DESC, idActivityEvents DESC
      LIMIT ?
    `,
    [safeLimit]
  );
}

export async function getTrendingEntities(db, days = 7, limit = 10) {
  const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

  return db.allAsync(
    `
      SELECT
        entity_type AS "entityType",
        entity_id AS "entityId",
        COUNT(*) AS "eventCount",
        COUNT(DISTINCT COALESCE(CAST(Users_idUsers AS TEXT), username)) AS "actorCount",
        MAX(created_at) AS "lastEventAt"
      FROM ActivityEvents
      WHERE
        created_at >= datetime('now', ?)
        AND entity_type IS NOT NULL
        AND entity_id IS NOT NULL
        AND entity_id != ''
      GROUP BY entity_type, entity_id
      ORDER BY eventCount DESC, actorCount DESC, lastEventAt DESC
      LIMIT ?
    `,
    [`-${safeDays} days`, safeLimit]
  );
}
