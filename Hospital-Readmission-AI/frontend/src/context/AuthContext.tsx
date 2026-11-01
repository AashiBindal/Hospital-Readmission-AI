import { createContext, useContext, useState, type ReactNode } from "react";

interface AuthUser {
  username: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Placeholder auth state. TODO (Member 1): wire to backend login endpoint. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, login: setUser, logout: () => setUser(null) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
