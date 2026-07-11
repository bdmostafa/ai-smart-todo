/**
 * DynamoDB data access layer
 *
 * Single-table design with:
 * - PK: USER#{userId}, SK: TASK#{taskId}
 * - GSI1PK: USER#{userId}#STATUS#incomplete, GSI1SK: SCORE#{priorityScore (zero-padded)}
 *
 * Retry strategy: 1 retry with 2-second interval for both reads and writes.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Task, TaskRecord } from './types';

const TABLE_NAME = process.env.TABLE_NAME || 'ai-smart-todo';
const GSI1_NAME = 'GSI1';
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 1;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// --- Key Builders ---

function buildPK(userId: string): string {
  return `USER#${userId}`;
}

function buildSK(taskId: string): string {
  return `TASK#${taskId}`;
}

function buildGSI1PK(userId: string): string {
  return `USER#${userId}#STATUS#incomplete`;
}

function buildGSI1SK(priorityScore: number): string {
  return `SCORE#${String(priorityScore).padStart(3, '0')}`;
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an operation with retry logic.
 * Retries once after a 2-second delay on failure.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

/**
 * Convert a DynamoDB record to a Task domain object.
 */
function recordToTask(record: Record<string, unknown>): Task {
  return {
    taskId: record.taskId as string,
    userId: record.userId as string,
    description: record.description as string,
    quadrant: record.quadrant as Task['quadrant'],
    priorityScore: record.priorityScore as number,
    status: record.status as Task['status'],
    createdAt: record.createdAt as string,
    completedAt: (record.completedAt as string) || null,
    aiProcessed: (record.aiProcessed as boolean) ?? false,
  };
}

/**
 * Build a full TaskRecord from a Task domain object.
 */
function taskToRecord(task: Task): TaskRecord {
  const record: TaskRecord = {
    PK: buildPK(task.userId),
    SK: buildSK(task.taskId),
    GSI1PK: task.status === 'incomplete' ? buildGSI1PK(task.userId) : `USER#${task.userId}#STATUS#complete`,
    GSI1SK: buildGSI1SK(task.priorityScore),
    userId: task.userId,
    taskId: task.taskId,
    description: task.description,
    quadrant: task.quadrant,
    priorityScore: task.priorityScore,
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    aiProcessed: task.aiProcessed,
  };
  return record;
}

// --- Public API ---

/**
 * Create a new task in DynamoDB.
 * Uses PutItem with full key structure including GSI1 keys.
 */
export async function createTask(task: Task): Promise<Task> {
  const record = taskToRecord(task);

  await withRetry(async () => {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
      })
    );
  });

  return task;
}

/**
 * Get all tasks for a user (both incomplete and complete).
 * Queries by PK = USER#{userId}.
 */
export async function getTasksByUser(userId: string): Promise<Task[]> {
  const result = await withRetry(async () => {
    return docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': buildPK(userId),
        },
      })
    );
  });

  return (result.Items || []).map(recordToTask);
}

/**
 * Get incomplete tasks for a user sorted by priority score (descending).
 * Queries GSI1 with GSI1PK = USER#{userId}#STATUS#incomplete, sorted by GSI1SK DESC.
 */
export async function getIncompleteTasksByScore(userId: string): Promise<Task[]> {
  const result = await withRetry(async () => {
    return docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI1_NAME,
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': buildGSI1PK(userId),
        },
        ScanIndexForward: false, // Descending order (highest score first)
      })
    );
  });

  return (result.Items || []).map(recordToTask);
}

/**
 * Update a task with partial updates.
 * Dynamically builds the UpdateExpression from the provided fields.
 * Recalculates GSI1 keys when status or priorityScore change.
 */
export async function updateTask(
  userId: string,
  taskId: string,
  updates: Partial<Task>
): Promise<Task> {
  // Build update expression dynamically
  const expressionParts: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  const allowedFields: (keyof Task)[] = [
    'description',
    'quadrant',
    'priorityScore',
    'status',
    'completedAt',
    'aiProcessed',
  ];

  for (const field of allowedFields) {
    if (field in updates) {
      const placeholder = `#${field}`;
      const valuePlaceholder = `:${field}`;
      expressionParts.push(`${placeholder} = ${valuePlaceholder}`);
      expressionAttributeNames[placeholder] = field;
      expressionAttributeValues[valuePlaceholder] = updates[field] ?? null;
    }
  }

  // Recalculate GSI1 keys if status or priorityScore changed
  const newStatus = updates.status;
  const newScore = updates.priorityScore;

  if (newStatus !== undefined || newScore !== undefined) {
    // We need current values to compute the new GSI keys.
    // If status changed, use new status; otherwise we assume incomplete for GSI update.
    // If score changed, use new score for GSI1SK.
    if (newStatus !== undefined) {
      expressionParts.push('#GSI1PK = :gsi1pk');
      expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
      expressionAttributeValues[':gsi1pk'] =
        newStatus === 'incomplete'
          ? buildGSI1PK(userId)
          : `USER#${userId}#STATUS#complete`;
    }

    if (newScore !== undefined) {
      expressionParts.push('#GSI1SK = :gsi1sk');
      expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
      expressionAttributeValues[':gsi1sk'] = buildGSI1SK(newScore);
    }
  }

  if (expressionParts.length === 0) {
    // Nothing to update — fetch and return existing task
    const tasks = await getTasksByUser(userId);
    const existing = tasks.find((t) => t.taskId === taskId);
    if (!existing) {
      throw new Error(`Task ${taskId} not found for user ${userId}`);
    }
    return existing;
  }

  const result = await withRetry(async () => {
    return docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: buildPK(userId),
          SK: buildSK(taskId),
        },
        UpdateExpression: `SET ${expressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );
  });

  return recordToTask(result.Attributes || {});
}

/**
 * Delete a task from DynamoDB.
 */
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await withRetry(async () => {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: buildPK(userId),
          SK: buildSK(taskId),
        },
      })
    );
  });
}
