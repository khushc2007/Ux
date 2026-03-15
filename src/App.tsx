import { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import ComingSoon from "./pages/ComingSoon";
import Preloader from "./components/Preloader";
import "./index.css";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const handleComplete = useCallback(() => setLoaded(true), []);

  return (
    <>
      {!loaded && <Preloader onComplete={handleComplete} />}
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/home"      element={<Home />} />
            <Route path="/dashboard" element={<ComingSoon page="Dashboard"  icon="◈" sub="Live sensor telemetry & analysis loop" />} />
            <Route path="/chamber"   element={<ComingSoon page="Chamber"    icon="⬡" sub="3D greywater treatment visualization" />} />
            <Route path="/history"   element={<ComingSoon page="History"    icon="◷" sub="Session logs & analytics" />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="*"          element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
