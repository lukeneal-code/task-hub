import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Task } from '@/types';
import toast from 'react-hot-toast';

/**
 * React Query hooks for task operations.
 */

/**
 * Hook to fetch tasks in a project.
 */
export function useTasks(
  projectId: string,
  params?: {
    status?: string;
    assigneeId?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }
) {
  return useQuery({
    queryKey: ['tasks', projectId, params],
    queryFn: () => api.listTasks(projectId, params),
    enabled: !!projectId,
  });
}

/**
 * Hook to fetch a single task.
 */
export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => api.getTask(id),
    enabled: !!id,
  });
}

/**
 * Hook to create a task.
 */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      priority?: string;
      assigneeId?: string;
      dueDate?: string;
    }) => api.createTask(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create task');
    },
  });
}

/**
 * Hook to update a task.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        assigneeId: string | null;
        dueDate: string | null;
      }>;
    }) => api.updateTask(id, data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] });
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
      toast.success('Task updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update task');
    },
  });
}

/**
 * Hook to delete a task.
 */
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete task');
    },
  });
}
