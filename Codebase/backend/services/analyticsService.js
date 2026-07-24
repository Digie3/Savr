import { logActivity } from "../lakehouse/lakehouse.js";
import { getDuckDB, GOLD_PATH } from "../lakehouse/duckdb.js";

export async function logActivityService(db, activity) {
    return await logActivity(db, activity);
}

function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function getAnalyticsDashboardService(username) {

    const db = getDuckDB();

    // Summary
    const totals = await query(
        db,
        `SELECT
            CAST(COUNT(*) AS INTEGER) AS totalEvents,
            MAX(created_at) AS lastEventAt
        FROM delta_scan('${GOLD_PATH}/activity_dashboard')
        WHERE username = ?`,
        [username]
    );

    // Events by Type
    const byType = await query(
        db,
        `SELECT
            event_type AS eventType,
            CAST(SUM(event_count) AS INTEGER) AS count
        FROM delta_scan('${GOLD_PATH}/user_activity_summary')
        WHERE username = ?
        GROUP BY event_type
        ORDER BY count DESC`,
        [username]
    );

    // Most Tracked Pages / Items
    const topEntities = await query(
        db,
        `SELECT
            entity_type AS entityType,
            entity_id AS entityId,
            CAST(SUM(event_count) AS INTEGER) AS count
        FROM delta_scan('${GOLD_PATH}/user_activity_summary')
        WHERE username = ?
            AND entity_type IS NOT NULL
            AND entity_id IS NOT NULL
            AND entity_id != ''
        GROUP BY entity_type, entity_id
        ORDER BY count DESC
        LIMIT 10`,
        [username]
    );

    // Recent Activity
    const events = await query(
        db,
        `SELECT
            CAST(idActivityEvents AS INTEGER) AS id,
            CAST(Users_idUsers AS INTEGER) AS userId,
            username,
            event_type AS eventType,
            entity_type AS entityType,
            entity_id AS entityId,
            event_value AS eventValue,
            metadata_json AS metadataJson,
            source,
            created_at AS createdAt
        FROM delta_scan('${GOLD_PATH}/activity_dashboard')
        WHERE username = ?
        ORDER BY created_at DESC, idActivityEvents DESC
        LIMIT 15`,
        [username]
    );

    return {
        totalEvents: Number(totals[0]?.totalEvents ?? 0),
        uniqueActors: totals[0]?.totalEvents ? 1 : 0,
        lastEventAt: totals[0]?.lastEventAt ?? null,
        byType,
        topEntities,
        actors: [
            {
                actor: username,
                count: Number(totals[0]?.totalEvents ?? 0),
                lastEventAt: totals[0]?.lastEventAt ?? null,
            },
        ],
        events
    };
}