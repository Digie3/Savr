import { useEffect, useState } from "react";
import { followUser, getFollowStatus, unfollowUser } from "../lib/followService";

function FollowButton({ userId }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadFollowStatus() {
      try {
        const data = await getFollowStatus(userId);

        if (isMounted) {
          setIsFollowing(Boolean(data.isFollowing));
        }
      } catch (err) {
        console.error("Failed to load follow status", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (userId) {
      loadFollowStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [userId]);

  async function handleClick() {
    setLoading(true);

    const data = isFollowing
      ? await unfollowUser(userId)
      : await followUser(userId);

    if (data.error) {
      alert(data.error);
      setLoading(false);
      return;
    }

    setIsFollowing(!isFollowing);
    setLoading(false);
  }

  return (
    <button onClick={handleClick} className="follow-btn" disabled={loading}>
      {loading ? "..." : isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}

export default FollowButton;