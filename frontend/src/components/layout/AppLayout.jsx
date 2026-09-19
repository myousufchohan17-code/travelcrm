import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import GlobalModals from "./GlobalModals";
import { useUi } from "../../context/UiContext";
import { Toasts } from "../ui/Common";

export default function AppLayout() {
  const { toasts } = useUi();
  const location = useLocation();
  const onAiPage = location.pathname.startsWith("/ai-assistant");

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
      {!onAiPage ? (
        <Link
          to="/ai-assistant"
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-blue-500/30 hover:bg-brand-700 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
          aria-label="Open AI Travel Assistant"
        >
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
        </Link>
      ) : null}
      <GlobalModals />
      <Toasts items={toasts} />
    </div>
  );
}
