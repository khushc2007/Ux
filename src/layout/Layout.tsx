import { Outlet } from "react-router-dom";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";

export default function Layout() {
  return (
    <>
      <TopBar />
      <main>
        <Outlet />
      </main>
      <BottomNav />
    </>
  );
}
