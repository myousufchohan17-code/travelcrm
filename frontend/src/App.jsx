import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Bookings from "./pages/Bookings";
import Packages from "./pages/Packages";
import Leads from "./pages/Leads";
import FollowUps from "./pages/FollowUps";
import Agents from "./pages/Agents";
import Destinations from "./pages/Destinations";
import Messages from "./pages/Messages";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/destinations" element={<Destinations />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
