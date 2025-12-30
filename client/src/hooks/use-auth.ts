import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && !currentPath.startsWith("/api")) {
        setLocation("/login");
      }
    }
  }, [user, isLoading, setLocation]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    queryClient.clear();
    setLocation("/login");
  };

  return { user, isLoading, logout };
}
