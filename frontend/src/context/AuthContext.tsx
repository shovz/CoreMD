import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, type UserMe } from "../api/authApi";

interface AuthContextValue {
  user: UserMe | null;
  setUser: (user: UserMe | null) => void;
  isInitializing: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsInitializing(false);
      return;
    }
    getMe()
      .then((me) => setUser(me))
      .catch((err) => {
        if (err?.response?.status === 401) {
          localStorage.removeItem("access_token");
        }
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const isAuthenticated = Boolean(localStorage.getItem("access_token"));

  return (
    <AuthContext.Provider value={{ user, setUser, isInitializing, isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
