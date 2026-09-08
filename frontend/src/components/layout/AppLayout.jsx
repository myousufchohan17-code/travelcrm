import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import GlobalModals from "./GlobalModals";
import { useUi } from "../../context/UiContext";
import { Toasts } from "../ui/Common";

export default function AppLayout() {
  const { toasts } = useUi();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-canvas">
      <Sidebar />
      <div className="min-w-0 lg:pl-[270px]">
        <Navbar />
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">
          <div key={location.pathname} className="page-fade min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalModals />
      <Toasts items={toasts} />
    </div>
  );
}
