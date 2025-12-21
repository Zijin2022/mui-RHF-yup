// Home.jsx
import { useNavigate } from "react-router-dom";

export default function Table() {
  const navigate = useNavigate();

  const goToProfile = () => {
    navigate("/Detail");
  };

  return (
    <div>
      <h1>Home</h1>
      <button onClick={goToProfile}>
        Go to Profile
      </button>
      <button onClick={() => navigate("/form")}>
        Go to form
      </button>
    </div>
  );
}
