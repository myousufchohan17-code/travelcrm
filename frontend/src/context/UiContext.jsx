import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const UiContext = createContext(null);

export function UiProvider({ children }) {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const toast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ refetchType: "active" });
  }, [queryClient]);

  const openModal = useCallback((type, payload = null) => {
    setModal({ type, payload });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const askConfirm = useCallback((options) => {
    setConfirm(options);
  }, []);

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
