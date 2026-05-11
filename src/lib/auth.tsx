import React, { createContext, useContext, useState, useEffect } from "react";

interface User {
  email: string;
  full_name: string;
  role: "Admin" | "User";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("vault_token");
    const savedUser = localStorage.getItem("vault_user");
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Check if token is expired (mock check by parsing base64 if needed, 
        // but for now simple local storage check)
        setToken(savedToken);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem("vault_token");
        localStorage.removeItem("vault_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, token: string, user: User) => {
    localStorage.setItem("vault_token", token);
    localStorage.setItem("vault_user", JSON.stringify(user));
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("vault_token");
    localStorage.removeItem("vault_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
