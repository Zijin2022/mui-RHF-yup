// Profile.jsx
import { useNavigate } from "react-router-dom";

export default function Detail() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Profile</h1>
      <button onClick={() => navigate("/")}>
        Back to Home
      </button>
    </div>
  );
}
