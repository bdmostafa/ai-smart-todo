import type {
  CreateTaskRequest,
  ErrorResponse,
  GetTasksResponse,
  TaskResponse,
} from '../types';

/**
 * API client for the AI Smart To-Do backend.
 *
 * - Configurable base URL via VITE_API_BASE_URL env var
 * - Injects x-api-key header from VITE_API_KEY env var
 * - Injects x-user-id header from provided userId
 * - Handles error responses and throws typed ApiError
 *
 * Requirements: 10.3, 10.5, 8.3
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  userId: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

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
    let errorBody: ErrorResponse | undefined;
    try {
      errorBody = (await response.json()) as ErrorResponse;
    } catch {
      // Response body may not be JSON
    }

    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.retryAfter,
    );
  }

  return response.json() as Promise<T>;
}

// --- API Methods ---

export function fetchTasks(userId: string): Promise<GetTasksResponse> {
  return request<GetTasksResponse>('/tasks', userId);
}

export function createTask(
  userId: string,
  data: CreateTaskRequest,
): Promise<TaskResponse> {
  return request<TaskResponse>('/tasks', userId, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function completeTask(
  userId: string,
  taskId: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${taskId}/complete`, userId, {
    method: 'PATCH',
  });
}

export function restoreTask(
  userId: string,
  taskId: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${taskId}/incomplete`, userId, {
    method: 'PATCH',
  });
}

export function deleteTask(userId: string, taskId: string): Promise<void> {
  return request<void>(`/tasks/${taskId}`, userId, {
    method: 'DELETE',
  });
}

export function refreshTopThree(userId: string): Promise<{ topThree: string[] }> {
  return request<{ topThree: string[] }>('/tasks/top-three', userId, {
    method: 'POST',
  });
}

export function recalculateScores(userId: string): Promise<GetTasksResponse> {
  return request<GetTasksResponse>('/tasks/recalculate', userId, {
    method: 'POST',
  });
}
