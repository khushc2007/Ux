import { Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

export default function Layout() {
  return (
    <>
      <TopBar />
      <main style={{ height: "calc(100dvh - 52px - var(--nav-h, 68px))", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}
