import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const UiContext = createContext(null);
const routeQueryKeys = {
  "/clients": [["clients"], ["client"], ["recent-clients"], ["dashboard-stats"], ["reports"], ["activities"]],
  "/bookings": [["bookings"], ["booking"], ["dashboard-stats"], ["bookings-overview"], ["upcoming-bookings"], ["reports"], ["inventory"], ["inventory-summary"], ["activities"]],
  "/destinations": [["destinations"], ["clients"], ["packages"], ["bookings"], ["leads"], ["dashboard-stats"], ["recent-clients"], ["reports"], ["activities"]],
  "/packages": [["packages"], ["package-categories"], ["bookings"], ["booking"], ["reports"], ["activities"]],
  "/agents": [["agents"], ["bookings"], ["leads"], ["follow-ups"], ["dashboard-stats"], ["reports"], ["activities"]],
  "/leads": [["leads"], ["clients"], ["recent-clients"], ["dashboard-stats"], ["reports"], ["activities"]],
  "/follow-ups": [["follow-ups"], ["activities"]],
  "/inventory": [["inventory"], ["inventory-summary"], ["bookings"], ["booking"], ["activities"]],
  "/invoices": [["invoices"], ["invoice"], ["invoices-summary"], ["bookings"], ["booking"], ["clients"], ["client"], ["activities"]],
  "/settings": [["agents"], ["destinations"], ["clients"], ["packages"], ["bookings"], ["leads"], ["follow-ups"], ["dashboard-stats"], ["recent-clients"], ["reports"], ["activities"]],
};

export function UiProvider({ children }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const toast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const invalidateAll = useCallback((queryKeys) => {
    if (Array.isArray(queryKeys)) {
      return Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "active" })));
    }
    return queryClient.invalidateQueries({ refetchType: "active" });
  }, [queryClient]);

  const openModal = useCallback((type, payload = null) => {
    setModal({ type, payload });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const askConfirm = useCallback((options) => {
    const path = `/${location.pathname.split("/")[1] || ""}`;
    setConfirm({ ...options, queryKeys: options.queryKeys || routeQueryKeys[path] || [] });
  }, [location.pathname]);

  const value = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toasts,
      toast,
      modal,
      openModal,
      closeModal,
      confirm,
      askConfirm,
      setConfirm,
      invalidateAll,
    }),
    [sidebarOpen, toasts, toast, modal, openModal, closeModal, confirm, askConfirm, invalidateAll]
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  return useContext(UiContext);
}
