import {
    logActivity,
    getAnalyticsSummary,
    getRecentEvents,
    getTrendingEntities,
} from "../lakehouse/lakehouse.js";

export async function logActivityService(db, activity) {
    return await logActivity(db, activity);
}

export async function getAnalyticsSummaryService(db) {
    return await getAnalyticsSummary(db);
}

export async function getRecentEventsService(db, limit) {
    return await getRecentEvents(db, limit);
}

export async function getTrendingEntitiesService(db, days, limit) {
    return await getTrendingEntities(db, days, limit);
}