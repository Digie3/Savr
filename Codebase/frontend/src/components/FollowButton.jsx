import { useEffect, useState } from "react";
import {
  followUser,
  getFollowStatus,
  unfollowUser,
} from "../lib/followService";

const FOLLOW_EVENT = "savr-follow-status-changed";

function FollowButton({ userId, onFollowChange }) {
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
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    function handleFollowEvent(event) {
      const changedUserId = Number(event.detail?.userId);

      if (changedUserId === Number(userId)) {
        setIsFollowing(Boolean(event.detail.isFollowing));
      }
    }

    if (userId) {
      loadFollowStatus();
    }

    window.addEventListener(FOLLOW_EVENT, handleFollowEvent);

    return () => {
      isMounted = false;
      window.removeEventListener(FOLLOW_EVENT, handleFollowEvent);
    };
  }, [userId]);

  async function handleClick() {
    try {
      setLoading(true);

      const newStatus = !isFollowing;

      const data = isFollowing
        ? await unfollowUser(userId)
        : await followUser(userId);

      if (data.error) {
        alert(data.error);
        return;
      }

      setIsFollowing(newStatus);

      // Update every FollowButton for this same creator.
      window.dispatchEvent(
        new CustomEvent(FOLLOW_EVENT, {
          detail: {
            userId: Number(userId),
            isFollowing: newStatus,
          },
        })
      );

      onFollowChange?.(Number(userId), newStatus);
    } catch (err) {
      console.error("Unable to update follow status", err);
      alert("Unable to update follow status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="follow-btn"
      disabled={loading}
    >
      {loading ? "..." : isFollowing ? "Unfollow" : "Follow"}
    </button>
  );
}

export default FollowButton;