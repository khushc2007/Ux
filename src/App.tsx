import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./layout/Layout";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import ComingSoon from "./pages/ComingSoon";
import HistoryPage from "./pages/history/HistoryPage";
import Dashboard from "./pages/Dashboard";
import GreywaterViz from "./pages/GreywaterViz";
import Preloader from "./components/Preloader";
import { startSimulator, stopSimulator } from "./lib/dataSimulator";
import { startAggregator, stopAggregator } from "./lib/aggregator";
import "./index.css";

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const handleComplete = useCallback(() => setLoaded(true), []);

  // Start the shared data stream once on app mount
  useEffect(() => {
    startSimulator();
    startAggregator();
    return () => {
      stopSimulator();
      stopAggregator();
    };
  }, []);

  return (
    <>
      {!loaded && <Preloader onComplete={handleComplete} />}
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="/home"      element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chamber"   element={<GreywaterViz />} />
            <Route path="/history"   element={<HistoryPage />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="*"          element={<Navigate to="/home" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
