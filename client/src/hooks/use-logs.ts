import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

interface LogQueryParams {
  taskId?: string;
  limit?: string;
}

export function useLogs(params?: LogQueryParams) {
  return useQuery({
    queryKey: [api.logs.list.path, params],
    queryFn: async () => {
      const url = new URL(window.location.origin + api.logs.list.path);
      if (params) {
        if (params.taskId) url.searchParams.append("taskId", params.taskId);
        if (params.limit) url.searchParams.append("limit", params.limit);
      }
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return api.logs.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Real-time feel
  });
}

export function useStats() {
  return useQuery({
    queryKey: [api.stats.get.path],
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return api.stats.get.responses[200].parse(await res.json());
    },
    refetchInterval: 10000,
  });
}
