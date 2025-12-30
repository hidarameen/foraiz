import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateTaskRequest, type UpdateTaskRequest } from "@shared/routes";

export function useTasks() {
  return useQuery({
    queryKey: [api.tasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.tasks.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return api.tasks.list.responses[200].parse(await res.json());
    },
  });
}

export function useTask(id: number) {
  return useQuery({
    queryKey: [api.tasks.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.tasks.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch task");
      return api.tasks.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTaskRequest) => {
      console.log("🚀 CREATE TASK: Sending request", { data });
      const res = await fetch(api.tasks.create.path, {
        method: api.tasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      console.log("📨 CREATE TASK: Response received", { status: res.status, statusText: res.statusText });
      const responseData = await res.json();
      console.log("📦 CREATE TASK: Response data", { responseData });
      if (!res.ok) {
        console.error("❌ CREATE TASK: Failed", { responseData });
        throw new Error(`Failed to create task: ${responseData?.message || "Unknown error"}`);
      }
      const parsed = api.tasks.create.responses[201].parse(responseData);
      console.log("✅ CREATE TASK: Success", { parsed });
      return parsed;
    },
    onSuccess: (data) => {
      console.log("🎉 CREATE TASK: Invalidating queries", { taskId: data.id });
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
    onError: (error) => {
      console.error("🔴 CREATE TASK: Mutation error", { error: (error as Error).message });
    }
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateTaskRequest) => {
      const url = buildUrl(api.tasks.update.path, { id });
      const res = await fetch(url, {
        method: api.tasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      return api.tasks.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.tasks.delete.path, { id });
      const res = await fetch(url, { 
        method: api.tasks.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] }),
  });
}

export function useToggleTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const url = buildUrl(api.tasks.toggle.path, { id });
      const res = await fetch(url, {
        method: api.tasks.toggle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle task");
      return api.tasks.toggle.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] }),
  });
}
