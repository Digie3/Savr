import { getDuckDB, GOLD_PATH } from "../lakehouse/duckdb.js";

export async function getCreatorDashboard(username) {

    const db = getDuckDB();

    const sql = 
        `SELECT
            cm.total_recipes_published,
            cm.total_ratings_received,
            cm.total_comments_received,
            cm.total_recipe_views,
            tr.most_viewed_recipe,
            tr.view_count,
            hr.highest_rated_recipe,
            hr.average_rating,
            hr.rating_count
        FROM delta_scan('${GOLD_PATH}/creator_metrics') cm
        LEFT JOIN delta_scan('${GOLD_PATH}/creator_top_recipe') tr
            ON cm.creator = tr.creator
        LEFT JOIN delta_scan('${GOLD_PATH}/creator_highest_rated') hr
            ON cm.creator = hr.creator
        WHERE cm.creator = ?`;

    return new Promise((resolve, reject) => {
        db.all(sql, [username], (err, rows) => {

            if (err) {
                reject(err);
            } 
            else {
                resolve(rows[0] || null);
            }
        });
    });
}