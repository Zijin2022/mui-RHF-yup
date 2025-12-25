// App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Table from "./routes/Demo-Table";
import Detail from "./routes/Demo-Detail";
import SampleForm from "./routes/SampleForm";
import Upload from "./routes/UploadSample";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Table />} />
        <Route path="/Detail" element={<Detail />} />
        <Route path="/form" element={<SampleForm />} />
        <Route path="/upload" element={<Upload />} />
      </Routes>
    </BrowserRouter>
  );
}
