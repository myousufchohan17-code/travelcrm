import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ company_name: "SkyTrail Travels" });
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    try {
      const [{ data: me }, { data: company }] = await Promise.all([
        api.get("/profile"),
        api.get("/settings"),
      ]);
      setUser(me);
      setSettings(company);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  const value = useMemo(
    () => ({ user, setUser, settings, setSettings, loading, refresh: bootstrap }),
    [user, settings, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
