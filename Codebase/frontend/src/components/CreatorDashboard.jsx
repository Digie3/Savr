import { useEffect, useState } from "react";
import { fetchCreatorDashboard } from "../lib/creatorService";

function CreatorDashboard() {

    const user = JSON.parse(localStorage.getItem("savrUser"));

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadDashboard() {

            try {

                const data = await fetchCreatorDashboard(
                    user.username
                );

                setStats(data);

            } catch (err) {

                console.error(err);

            } finally {

                setLoading(false);

            }

        }

        loadDashboard();

    }, []);

    if (loading) {
        return <h2>Loading dashboard...</h2>;
    }
    
    if (!stats) {
        return <h2>No dashboard data found.</h2>;
    }

    return (
        <div className="creator-dashboard">

            <div className="dashboard-card">
                <h3>Total Recipes Published</h3>
                <p>{stats.total_recipes_published}</p>
            </div>

            <div className="dashboard-card">
                <h3>Total Ratings Received</h3>
                <p>{stats.total_ratings_received}</p>
            </div>

            <div className="dashboard-card">
                <h3>Total Comments Received</h3>
                <p>{stats.total_comments_received}</p>
            </div>

            <div className="dashboard-card">
                <h3>Total Recipe Views</h3>
                <p>{stats.total_recipe_views}</p>
            </div>

            <div className="dashboard-card">
                <h3>Most Viewed Recipe</h3>

                <p>
                    <strong>{stats.most_viewed_recipe}</strong>
                </p>

                <small>
                    {stats.view_count} views
                </small>

            </div>

        </div>
    );
}

export default CreatorDashboard;