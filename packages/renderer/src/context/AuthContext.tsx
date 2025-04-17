import { useState, useEffect, useMemo } from "react";
import { AuthContext, AuthProviderProps } from "./AuthContext.defs";
import {
  secretLogin,
  secretLogout,
  getSecret,
  connectToMqtt,
} from "@app/preload";

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Function to check and update authentication state
  const refreshAuthState = async () => {
    setIsLoading(true);
    try {
      const certificate = await getSecret("certificate");
      const storedUserId = await getSecret("userId");

      setIsAuthenticated(!!certificate);
      setUserId(storedUserId || null);
    } catch (error) {
      console.error("Error checking auth state:", error);
      setIsAuthenticated(false);
      setUserId(null);
    } finally {
      await connectToMqtt();
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (
    newUserId: string,
    certificate: string,
    privateKey: string
  ) => {
    await secretLogin(certificate, privateKey, newUserId);
    await connectToMqtt();
    setUserId(newUserId);
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = async () => {
    try {
      await secretLogout();
      setIsAuthenticated(false);
      setUserId(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  // Check authentication state on mount
  useEffect(() => {
    refreshAuthState();
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      userId,
      login,
      logout,
      refreshAuthState,
    }),
    [isAuthenticated, isLoading, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
