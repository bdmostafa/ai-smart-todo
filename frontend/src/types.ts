/**
 * Shared type definitions for the AI Smart To-Do frontend.
 */

// --- Enums and Union Types ---

/** Eisenhower Matrix quadrant classification */
export type Quadrant = 'do-first' | 'schedule' | 'delegate' | 'eliminate';

/** Task completion status */
export type TaskStatus = 'incomplete' | 'complete';

/** API error codes */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR';

// --- Domain Models ---

/** A single task displayed in the frontend */
export interface Task {
  taskId: string;
  description: string;
  quadrant: Quadrant;
  priorityScore: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

// --- Application State ---

/** Global application state */
export interface AppState {
  tasks: Task[];
  topThree: string[]; // taskId references
  isLoading: boolean;
  error: string | null;
  userId: string;
}

// --- API Contracts ---

/** POST /tasks request body */
export interface CreateTaskRequest {
  description: string;
}

/** Task response from the API */
export interface TaskResponse {
  taskId: string;
  description: string;
  quadrant: Quadrant;
  priorityScore: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

/** GET /tasks response */
export interface GetTasksResponse {
  tasks: TaskResponse[];
  topThree: string[];
}

/** Error detail from the API */
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
}

/** Standard error response from the API */
export interface ErrorResponse {
  error: ErrorDetail;
}
