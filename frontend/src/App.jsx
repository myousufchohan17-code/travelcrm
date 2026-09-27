import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import { Loader } from "./components/ui/Common";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Packages = lazy(() => import("./pages/Packages"));
const Leads = lazy(() => import("./pages/Leads"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const Agents = lazy(() => import("./pages/Agents"));
const Destinations = lazy(() => import("./pages/Destinations"));
const Messages = lazy(() => import("./pages/Messages"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const AiAssistant = lazy(() => import("./pages/AiAssistant"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Invoices = lazy(() => import("./pages/Invoices"));

function page(Page) {
  return <Suspense fallback={<div className="card"><Loader /></div>}><Page /></Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={page(Dashboard)} />
        <Route path="/clients" element={page(Clients)} />
        <Route path="/bookings" element={page(Bookings)} />
        <Route path="/invoices" element={page(Invoices)} />
        <Route path="/packages" element={page(Packages)} />
        <Route path="/leads" element={page(Leads)} />
        <Route path="/follow-ups" element={page(FollowUps)} />
        <Route path="/agents" element={page(Agents)} />
        <Route path="/destinations" element={page(Destinations)} />
        <Route path="/messages" element={page(Messages)} />
        <Route path="/reports" element={page(Reports)} />
        <Route path="/settings" element={page(Settings)} />
        <Route path="/ai-assistant" element={page(AiAssistant)} />
        <Route path="/inventory" element={page(Inventory)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
