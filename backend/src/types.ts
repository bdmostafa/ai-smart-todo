/**
 * Core type definitions for the AI Smart To-Do backend.
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

/** A single to-do task with AI-enriched metadata */
export interface Task {
  taskId: string;
  userId: string;
  description: string;
  quadrant: Quadrant;
  priorityScore: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  aiProcessed: boolean;
}

// --- API Request Types ---

/** POST /tasks request body */
export interface CreateTaskRequest {
  description: string;
}

// --- API Response Types ---

/** Successful task creation/retrieval response */
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

/** Generic successful API response wrapper */
export interface ApiResponse<T = unknown> {
  data: T;
  statusCode: number;
}

/** Error detail within an error response */
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
}

/** Standard error response body */
export interface ErrorResponse {
  error: ErrorDetail;
}

// --- AI Service Types ---

/** Result returned from the AI categorization and scoring engine */
export interface AiResult {
  quadrant: Quadrant;
  priorityScore: number;
  reasoning: string;
}

// --- Validation Types ---

/** Result of a validation operation */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// --- DynamoDB Types ---

/** DynamoDB record shape for a task (includes key attributes) */
export interface TaskRecord {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  userId: string;
  taskId: string;
  description: string;
  quadrant: Quadrant;
  priorityScore: number;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  aiProcessed: boolean;
}

// --- Lambda Event Types ---

/** Parsed API Gateway event for internal routing */
export interface ApiEvent {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string>;
  headers: Record<string, string | undefined>;
  body: string | null;
}

/** Lambda response shape for API Gateway proxy integration */
export interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
