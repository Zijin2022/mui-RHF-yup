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
      <button onClick={() => navigate("/form", {
        state: {
          name: '田中太郎',
          email: 'tanaka@example.com',
          age: 30,
          gender: 'male',
          zipcode: '1640001',
        },
      })}>
        Go to form
      </button>
      <button onClick={() => navigate("/upload")}>
        Go to uplaod
      </button>
    </div>
  );
}
