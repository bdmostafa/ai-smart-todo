import type {
  CreateTaskRequest,
  TaskResponse,
  GetTasksResponse,
  ErrorResponse,
} from '../types';
import { regenerateUserId } from './userId';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

/**
 * Custom error class for API errors with status code and error code.
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Internal helper to make fetch requests with common headers.
 * Handles 401 responses by regenerating the userId and retrying once.
 *
 * Requirements: 8.5, 10.4
 */
async function request<T>(
  path: string,
  userId: string,
  options: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'x-user-id': userId,
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let code = 'INTERNAL_ERROR';
    let message = `Request failed with status ${response.status}`;

    try {
      const body: ErrorResponse = await response.json();
      code = body.error.code;
      message = body.error.message;
    } catch {
      // Use defaults if response body isn't parseable
    }

    // Handle 401: regenerate userId and retry once
    if (response.status === 401 && !isRetry) {
      const newUserId = regenerateUserId();
      return request<T>(path, newUserId, options, true);
    }

    throw new ApiError(response.status, code, message);
  }

  // Handle 204 No Content (e.g., delete)
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch all tasks for a user.
 * GET /tasks
 */
export async function fetchTasks(userId: string): Promise<GetTasksResponse> {
  return request<GetTasksResponse>('/tasks', userId);
}

/**
 * Create a new task.
 * POST /tasks
 */
export async function createTask(
  userId: string,
  body: CreateTaskRequest,
): Promise<TaskResponse> {
  return request<TaskResponse>('/tasks', userId, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Mark a task as complete.
 * PATCH /tasks/{taskId}/complete
 */
export async function completeTask(
  userId: string,
  taskId: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${taskId}/complete`, userId, {
    method: 'PATCH',
  });
}

/**
 * Restore a task to incomplete.
 * PATCH /tasks/{taskId}/incomplete
 */
export async function restoreTask(
  userId: string,
  taskId: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${taskId}/incomplete`, userId, {
    method: 'PATCH',
  });
}

/**
 * Delete a task.
 * DELETE /tasks/{taskId}
 */
export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<void> {
  return request<void>(`/tasks/${taskId}`, userId, {
    method: 'DELETE',
  });
}

/**
 * Refresh top-three recommendations.
 * POST /tasks/top-three
 */
export async function refreshTopThree(
  userId: string,
): Promise<{ topThree: string[] }> {
  return request<{ topThree: string[] }>('/tasks/top-three', userId, {
    method: 'POST',
  });
}

/**
 * Trigger priority recalculation for all tasks.
 * POST /tasks/recalculate
 */
export async function recalculate(userId: string): Promise<GetTasksResponse> {
  return request<GetTasksResponse>('/tasks/recalculate', userId, {
    method: 'POST',
  });
}
