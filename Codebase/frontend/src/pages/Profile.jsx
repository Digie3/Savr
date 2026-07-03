import FollowButton from "../components/FollowButton";
import { useParams } from "react-router-dom";

function Profile() {
  const { userId } = useParams();
  const profileUserId = Number(userId) || 1;

  return (
    <main className="page">
      <h1>Creator Profile</h1>
      <p>Profile for user #{profileUserId}. Their recipe posts can be connected here next.</p>

      <FollowButton userId={profileUserId} />
    </main>
  );
}

export default Profile;
