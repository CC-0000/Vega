import { useState, useEffect, useMemo } from "react";
import { AuthContext, AuthProviderProps } from "./AuthContext.defs";
import {
  secretLogin,
  secretLogout,
  getSecret,
  connectToMqtt,
  disconnectFromMqtt,
} from "@app/preload";

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [alias, setAlias] = useState<string | null>(null);

  // Function to check and update authentication state
  const refreshAuthState = async () => {
    try {
      setIsLoading(true);
      try {
        const certificate = await getSecret("certificate");
        const storedUserId = await getSecret("userId");
        const storedAlias = await getSecret("alias");

        setIsAuthenticated(!!certificate);
        setUserId(storedUserId || null);
        setAlias(storedAlias || null);
      } catch (error) {
        console.error("Error checking auth state:", error);
        setIsAuthenticated(false);
        setUserId(null);
        setAlias(null);
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error checking auth state:", error);
    }
  };

  // Login function
  const login = async (
    newUserId: string,
    certificate: string,
    privateKey: string,
    alias: string
  ) => {
    await secretLogin(certificate, privateKey, newUserId, alias);
    setUserId(newUserId);
    setAlias(alias);
    setIsAuthenticated(true);
    await connectToMqtt();
  };

  // Logout function
  const logout = async () => {
    try {
      await secretLogout();
      setIsAuthenticated(false);
      setUserId(null);
      await disconnectFromMqtt();
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
      alias,
      login,
      logout,
      refreshAuthState,
    }),
    [isAuthenticated, isLoading, userId, alias]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
