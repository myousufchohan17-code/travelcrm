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
    <div className="min-h-screen w-full max-w-[100vw] min-w-0 overflow-x-hidden bg-canvas">
      <Sidebar />
      <div className="w-full min-w-0 lg:pl-[270px]">
        <Navbar />
        <main className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <div key={location.pathname} className="page-fade w-full min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalModals />
      <Toasts items={toasts} />
    </div>
  );
}
