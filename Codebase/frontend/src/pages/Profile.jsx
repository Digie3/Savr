import FollowButton from "../components/FollowButton";

function Profile() {
  return (
    <main className="page">
      <h1>Creator Profile</h1>
      <p>Follow feature test profile</p>

      <FollowButton userId={1} />
    </main>
  );
}

export default Profile;