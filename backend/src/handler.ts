/**
 * Lambda entry point and request routing.
 *
 * Handles all API Gateway proxy integration requests:
 * - POST /tasks — Create a new task
 * - GET /tasks — Get all tasks for user
 * - PATCH /tasks/{taskId}/complete — Mark task as complete
 * - PATCH /tasks/{taskId}/incomplete — Restore task to incomplete
 * - DELETE /tasks/{taskId} — Delete a task
 * - POST /tasks/top-three — Generate/refresh top-three recommendations
 * - POST /tasks/recalculate — Trigger priority recalculation
 *
 * Requirements: 8.1, 8.2, 8.5, 8.6
 */

import { ApiEvent, ApiGatewayResponse, ErrorResponse, ErrorCode } from './types';
import { validateUserId, validateCreateTaskRequest } from './validator';
import * as taskService from './taskService';
import * as dbService from './dbService';

// --- CORS Headers ---

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

// --- Response Helpers ---

function buildResponse(statusCode: number, body: unknown): ApiGatewayResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function buildErrorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  retryAfter?: number
): ApiGatewayResponse {
  const errorBody: ErrorResponse = {
    error: {
      code,
      message,
      ...(retryAfter !== undefined && { retryAfter }),
    },
  };
  return buildResponse(statusCode, errorBody);
}

// --- Route Matching ---

interface RouteMatch {
  route: string;
  params: Record<string, string>;
}

/**
 * Match the incoming request path and method against known routes.
 * Returns the matched route name and extracted path parameters.
 */
function matchRoute(method: string, path: string): RouteMatch | null {
  // Normalize path: remove trailing slash
  const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  // OPTIONS preflight (handled for any path)
  if (method === 'OPTIONS') {
    return { route: 'OPTIONS', params: {} };
  }

  // POST /tasks/top-three
  if (method === 'POST' && normalizedPath === '/tasks/top-three') {
    return { route: 'POST /tasks/top-three', params: {} };
  }

  // POST /tasks/recalculate
  if (method === 'POST' && normalizedPath === '/tasks/recalculate') {
    return { route: 'POST /tasks/recalculate', params: {} };
  }

  // POST /tasks
  if (method === 'POST' && normalizedPath === '/tasks') {
    return { route: 'POST /tasks', params: {} };
  }

  // GET /tasks
  if (method === 'GET' && normalizedPath === '/tasks') {
    return { route: 'GET /tasks', params: {} };
  }

  // PATCH /tasks/{taskId}/complete
  const completeMatch = normalizedPath.match(/^\/tasks\/([^/]+)\/complete$/);
  if (method === 'PATCH' && completeMatch) {
    return { route: 'PATCH /tasks/{taskId}/complete', params: { taskId: completeMatch[1] } };
  }

  // PATCH /tasks/{taskId}/incomplete
  const incompleteMatch = normalizedPath.match(/^\/tasks\/([^/]+)\/incomplete$/);
  if (method === 'PATCH' && incompleteMatch) {
    return { route: 'PATCH /tasks/{taskId}/incomplete', params: { taskId: incompleteMatch[1] } };
  }

  // DELETE /tasks/{taskId}
  const deleteMatch = normalizedPath.match(/^\/tasks\/([^/]+)$/);
  if (method === 'DELETE' && deleteMatch) {
    return { route: 'DELETE /tasks/{taskId}', params: { taskId: deleteMatch[1] } };
  }

  return null;
}

// --- Route Handlers ---

async function handleCreateTask(userId: string, body: string | null): Promise<ApiGatewayResponse> {
  // Parse request body
  let parsedBody: unknown;
  try {
    parsedBody = body ? JSON.parse(body) : null;
  } catch {
    return buildErrorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
  }

  // Validate request body
  const validation = validateCreateTaskRequest(parsedBody);
  if (!validation.valid) {
    return buildErrorResponse(400, 'VALIDATION_ERROR', validation.error || 'Invalid request body');
  }

  const { description } = parsedBody as { description: string };

  try {
    const task = await taskService.createTask(userId, description);
    return buildResponse(200, {
      taskId: task.taskId,
      description: task.description,
      quadrant: task.quadrant,
      priorityScore: task.priorityScore,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create task';
    if (message.includes('AI') || message.includes('Bedrock')) {
      return buildErrorResponse(503, 'AI_UNAVAILABLE', 'AI service is temporarily unavailable', 30);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleGetTasks(userId: string): Promise<ApiGatewayResponse> {
  try {
    const tasks = await dbService.getTasksByUser(userId);
    const topThree = await taskService.getTopThree(userId);

    return buildResponse(200, {
      tasks: tasks.map((t) => ({
        taskId: t.taskId,
        description: t.description,
        quadrant: t.quadrant,
        priorityScore: t.priorityScore,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
      topThree,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve tasks';
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleCompleteTask(userId: string, taskId: string): Promise<ApiGatewayResponse> {
  try {
    const task = await taskService.completeTask(userId, taskId);
    return buildResponse(200, {
      taskId: task.taskId,
      description: task.description,
      quadrant: task.quadrant,
      priorityScore: task.priorityScore,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to complete task';
    if (message.includes('not found')) {
      return buildErrorResponse(404, 'NOT_FOUND', message);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleIncompleteTask(userId: string, taskId: string): Promise<ApiGatewayResponse> {
  try {
    const task = await taskService.restoreTask(userId, taskId);
    return buildResponse(200, {
      taskId: task.taskId,
      description: task.description,
      quadrant: task.quadrant,
      priorityScore: task.priorityScore,
      status: task.status,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to restore task';
    if (message.includes('not found')) {
      return buildErrorResponse(404, 'NOT_FOUND', message);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleDeleteTask(userId: string, taskId: string): Promise<ApiGatewayResponse> {
  try {
    await taskService.deleteTask(userId, taskId);
    return buildResponse(200, { message: 'Task deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete task';
    if (message.includes('not found')) {
      return buildErrorResponse(404, 'NOT_FOUND', message);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleTopThree(userId: string): Promise<ApiGatewayResponse> {
  try {
    const topThree = await taskService.getTopThree(userId);
    return buildResponse(200, { topThree });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate top three';
    if (message.includes('AI') || message.includes('Bedrock')) {
      return buildErrorResponse(503, 'AI_UNAVAILABLE', 'AI service is temporarily unavailable', 30);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

async function handleRecalculate(userId: string): Promise<ApiGatewayResponse> {
  try {
    const tasks = await taskService.recalculate(userId);
    return buildResponse(200, {
      tasks: tasks.map((t) => ({
        taskId: t.taskId,
        description: t.description,
        quadrant: t.quadrant,
        priorityScore: t.priorityScore,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to recalculate';
    if (message.includes('AI') || message.includes('Bedrock')) {
      return buildErrorResponse(503, 'AI_UNAVAILABLE', 'AI service is temporarily unavailable', 30);
    }
    return buildErrorResponse(500, 'INTERNAL_ERROR', message);
  }
}

// --- Main Handler ---

/**
 * Lambda entry point.
 * Parses the API Gateway proxy event, validates userId, routes to handler.
 */
export async function handler(event: ApiEvent): Promise<ApiGatewayResponse> {
  const { httpMethod, path, headers, body } = event;

  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return buildResponse(204, '');
  }

  // Match route
  const route = matchRoute(httpMethod, path);
  if (!route) {
    return buildErrorResponse(404, 'NOT_FOUND', `Route not found: ${httpMethod} ${path}`);
  }

  // Extract userId from headers (case-insensitive header lookup)
  const userId = headers['x-user-id'] || headers['X-User-Id'] || headers['X-USER-ID'];

  if (!userId) {
    return buildErrorResponse(400, 'VALIDATION_ERROR', 'Missing required header: x-user-id');
  }

  // Validate userId format
  if (!validateUserId(userId)) {
    return buildErrorResponse(400, 'VALIDATION_ERROR', 'Invalid x-user-id header: must be a valid UUID v4');
  }

  // Route to appropriate handler
  switch (route.route) {
    case 'POST /tasks':
      return handleCreateTask(userId, body);

    case 'GET /tasks':
      return handleGetTasks(userId);

    case 'PATCH /tasks/{taskId}/complete':
      return handleCompleteTask(userId, route.params.taskId);

    case 'PATCH /tasks/{taskId}/incomplete':
      return handleIncompleteTask(userId, route.params.taskId);

    case 'DELETE /tasks/{taskId}':
      return handleDeleteTask(userId, route.params.taskId);

    case 'POST /tasks/top-three':
      return handleTopThree(userId);

    case 'POST /tasks/recalculate':
      return handleRecalculate(userId);

    default:
      return buildErrorResponse(404, 'NOT_FOUND', `Route not found: ${httpMethod} ${path}`);
  }
}
