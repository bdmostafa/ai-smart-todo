# Implementation Plan: AI Smart To-Do with Priority Scoring

## Overview

This plan implements a serverless AI-powered task management application using React + Vite (frontend), a single AWS Lambda function with route handling (backend), DynamoDB single-table design (storage), and Amazon Bedrock Claude 3 Haiku (AI). The implementation follows an incremental approach: backend foundation first, then AI integration, followed by the frontend, and finally wiring everything together.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize project structure with backend and frontend directories
    - Create `backend/` directory with `src/` containing module files: `handler.ts`, `validator.ts`, `taskService.ts`, `aiService.ts`, `dbService.ts`, `scorer.ts`
    - Create `frontend/` directory with React + Vite scaffold
    - Set up `tsconfig.json` for both frontend and backend
    - Add shared type definitions for `Task`, `AppState`, quadrant enum, and API contracts
    - Install dependencies: `uuid`, `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`
    - Install dev dependencies: `vitest`, `fast-check`, `typescript`, `@types/node`
    - _Requirements: 8.1, 9.1_

  - [x] 1.2 Define TypeScript interfaces and types
    - Create `backend/src/types.ts` with `Task`, `CreateTaskRequest`, `ApiResponse`, `ErrorResponse`, `AiResult` interfaces
    - Define quadrant type: `'do-first' | 'schedule' | 'delegate' | 'eliminate'`
    - Define status type: `'incomplete' | 'complete'`
    - Define error codes: `VALIDATION_ERROR | NOT_FOUND | AI_UNAVAILABLE | INTERNAL_ERROR`
    - _Requirements: 9.1, 8.6_

- [x] 2. Implement input validation module
  - [x] 2.1 Implement task description validator
    - Create `backend/src/validator.ts`
    - Implement `validateDescription(input: string)`: trim whitespace, check length 1-500, reject empty/whitespace-only
    - Return typed result with error messages indicating allowed character range
    - _Requirements: 1.2, 1.3_

  - [ ]* 2.2 Write property test for task description validation
    - **Property 1: Task description validation**
    - **Validates: Requirements 1.2, 1.3**
    - Use fast-check to generate random strings (0-1000 chars), whitespace variants, unicode
    - Assert: accepted iff trimmed length in [1, 500]; rejected for empty, whitespace-only, or >500 after trim

  - [x] 2.3 Implement UUID v4 validator and generator
    - Add `validateUserId(id: string): boolean` using regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
    - Add `generateUserId(): string` using `crypto.randomUUID()` or `uuid` package
    - _Requirements: 10.1, 10.4_

  - [ ]* 2.4 Write property test for UUID v4 validation
    - **Property 8: UUID v4 validation and generation**
    - **Validates: Requirements 10.1, 10.4**
    - Generate random strings (valid UUID v4, invalid formats, empty)
    - Assert: validation accepts iff format matches UUID v4 spec; generated UUIDs always pass validation

  - [x] 2.5 Implement request body validator
    - Add `validateCreateTaskRequest(body: unknown)`: check required `description` field exists, is string type, passes description validation
    - Return 400-style error with field-specific messages for missing/invalid fields
    - _Requirements: 8.6, 1.3_

  - [ ]* 2.6 Write property test for request body validation
    - **Property 10: Request body validation**
    - **Validates: Requirements 8.6, 1.3**
    - Generate random objects (missing fields, wrong types, boundary values)
    - Assert: returns 400 error with field messages when invalid; passes when all constraints met

- [ ] 3. Implement DynamoDB data layer
  - [-] 3.1 Implement DynamoDB service module
    - Create `backend/src/dbService.ts`
    - Implement `createTask(task: Task): Promise<Task>` — PutItem with PK=`USER#{userId}`, SK=`TASK#{taskId}`, GSI1PK/GSI1SK
    - Implement `getTasksByUser(userId: string): Promise<Task[]>` — Query by PK
    - Implement `getIncompleteTasksByScore(userId: string): Promise<Task[]>` — Query GSI1
    - Implement `updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<Task>` — UpdateItem
    - Implement `deleteTask(userId: string, taskId: string): Promise<void>` — DeleteItem
    - Include retry logic: 1 retry with 2-second interval for both read and write operations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 3.2 Write property test for data persistence round-trip
    - **Property 7: Task data persistence round-trip**
    - **Validates: Requirements 9.1**
    - Generate random valid task objects covering all field combinations
    - Assert: store then retrieve returns identical values for description, quadrant, priorityScore, status, createdAt

- [ ] 4. Implement AI service integration
  - [~] 4.1 Implement Bedrock AI service module
    - Create `backend/src/aiService.ts`
    - Implement `categorizeAndScore(description: string, taskCount: number): Promise<AiResult>` — construct prompt, invoke Bedrock Claude 3 Haiku, parse response
    - Build prompt template with quadrant rules, scoring rules, task context, and current date
    - Implement response parser: extract `quadrant`, `priorityScore` from AI JSON response
    - Apply defaults on parse failure: quadrant = "schedule", priorityScore = 50
    - Implement retry logic: 3 retries with 5-second intervals
    - Implement circuit breaker: after 3 consecutive failures, stop calls for 60 seconds, assign defaults
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 2.4, 2.5, 3.5_

  - [ ]* 4.2 Write property test for AI response parsing
    - **Property 2: AI response parsing produces valid domain values**
    - **Validates: Requirements 2.1, 3.1, 3.5**
    - Generate random JSON-like strings, partial responses, malformed output
    - Assert: always produces valid quadrant from enum and integer score in [1, 100]; defaults on failure

- [ ] 5. Implement scoring and top-three logic
  - [~] 5.1 Implement priority scorer module
    - Create `backend/src/scorer.ts`
    - Implement `selectTopThree(tasks: Task[]): string[]` — sort incomplete tasks by priorityScore descending, return top 3 taskIds (or fewer if <3 exist)
    - Implement `recalculateScores(tasks: Task[]): Promise<Task[]>` — batch re-invoke AI for all incomplete tasks
    - Implement `getTaskOrdering(tasks: Task[]): Task[]` — group by quadrant [do-first, schedule, delegate, eliminate], sort within quadrant by score desc then createdAt desc
    - _Requirements: 4.2, 4.4, 3.4, 7.1, 7.2_

  - [ ]* 5.2 Write property test for top-three selection
    - **Property 3: Top-three selection correctness**
    - **Validates: Requirements 4.2, 4.4**
    - Generate random task arrays (0-50 items) with random scores 1-100
    - Assert: returns highest-scored tasks in descending order; returns all when <3; returns empty when none

  - [ ]* 5.3 Write property test for task ordering within quadrant view
    - **Property 6: Task ordering within quadrant view**
    - **Validates: Requirements 7.1, 7.2**
    - Generate random tasks in same/different quadrants with random scores and timestamps
    - Assert: grouped by quadrant in correct order; within quadrant sorted by score desc, ties by createdAt desc

- [ ] 6. Implement task service business logic
  - [~] 6.1 Implement task service orchestration
    - Create `backend/src/taskService.ts`
    - Implement `createTask(userId: string, description: string)`: validate → write to DDB with defaults → invoke AI → update task with AI results (write-then-enrich pattern)
    - Implement `completeTask(userId: string, taskId: string)`: update status to "complete", set completedAt, update GSI keys
    - Implement `restoreTask(userId: string, taskId: string)`: update status to "incomplete", clear completedAt, restore GSI keys with original quadrant
    - Implement `deleteTask(userId: string, taskId: string)`: remove from DDB
    - Implement `getTopThree(userId: string)`: get incomplete tasks, apply selectTopThree
    - Implement `recalculate(userId: string)`: get incomplete tasks, re-score all, update DDB
    - _Requirements: 1.1, 1.4, 5.1, 5.3, 5.5, 6.2, 6.3, 4.1, 4.5, 3.4_

  - [ ]* 6.2 Write property test for task completion round-trip
    - **Property 5: Task completion round-trip**
    - **Validates: Requirements 5.5**
    - Generate random tasks with known quadrants
    - Assert: complete then restore preserves original quadrant

  - [ ]* 6.3 Write property test for view filtering invariant
    - **Property 4: View filtering invariant**
    - **Validates: Requirements 5.3, 6.3**
    - Generate random task arrays with mixed statuses and deletion flags
    - Assert: active view contains only incomplete, non-deleted tasks

- [ ] 7. Implement Lambda handler with API routing
  - [~] 7.1 Implement Lambda entry point and route handler
    - Create `backend/src/handler.ts`
    - Implement route matching for all endpoints: POST /tasks, GET /tasks, PATCH /tasks/{taskId}/complete, PATCH /tasks/{taskId}/incomplete, DELETE /tasks/{taskId}, POST /tasks/top-three, POST /tasks/recalculate
    - Extract userId from request headers
    - Validate userId format on every request
    - Return proper HTTP status codes and JSON error responses
    - Handle CORS headers for frontend access
    - _Requirements: 8.1, 8.2, 8.5, 8.6_

  - [~] 7.2 Implement API key authorization middleware
    - Add middleware function that checks for API key header presence and value match
    - Return 401 Unauthorized with appropriate error body for missing/invalid keys
    - Apply middleware before any route processing
    - _Requirements: 8.3, 8.4_

  - [ ]* 7.3 Write property test for API key authorization
    - **Property 9: API key authorization gate**
    - **Validates: Requirements 8.3, 8.4**
    - Generate random header objects (with/without key, valid/invalid values)
    - Assert: allows processing iff valid key present; rejects with 401 otherwise

- [~] 8. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement React frontend - Core components
  - [~] 9.1 Set up React frontend with Vite and state management
    - Initialize Vite React TypeScript project in `frontend/`
    - Set up app state management (React Context or Zustand) with `AppState` interface
    - Implement userId generation/retrieval from localStorage on app load
    - Implement API client module with API key header and userId header injection
    - Implement optimistic update pattern with rollback on failure
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [~] 9.2 Implement TaskInput component
    - Build text input with character counter (1-500 chars)
    - Implement client-side trim and validation before submission
    - Display validation error messages for empty/whitespace-only/over-500 descriptions
    - Clear input on successful creation; preserve input on failure
    - Call POST /tasks API on submit
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [~] 9.3 Implement TopThreePanel component
    - Display dedicated section above the task list
    - Show up to 3 recommended tasks with their details
    - Handle fewer than 3 tasks gracefully
    - Show empty state message when no incomplete tasks exist
    - Refresh top-three when a task is completed or deleted
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [~] 9.4 Implement QuadrantView component
    - Render four-panel Eisenhower Matrix layout
    - Display quadrants in order: Do First, Schedule, Delegate, Eliminate
    - Sort tasks within each quadrant by priorityScore descending, ties by createdAt descending
    - Show placeholder message in empty quadrants
    - Show invitation prompt when no tasks exist at all
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 9.5 Implement TaskCard component
    - Display task description, quadrant label, and priority score
    - Add complete/incomplete toggle button
    - Add delete button with confirmation dialog
    - Apply strikethrough and reduced opacity for completed tasks
    - _Requirements: 2.2, 3.3, 5.2, 6.1_

  - [~] 9.6 Implement CompletedSection and ErrorBanner components
    - Build collapsible completed tasks section below active list
    - Display completed tasks with strikethrough styling
    - Build non-blocking error banner with auto-dismiss on retry success
    - Show specific error messages for different failure types
    - _Requirements: 5.4, 1.6, 6.5_

- [~] 10. Checkpoint - Frontend components complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Integration and wiring
  - [~] 11.1 Wire frontend to backend API
    - Connect all component actions to API client calls
    - Implement loading states during API calls
    - Handle 503 AI_UNAVAILABLE responses: show task with defaults, schedule retry
    - Handle 401 responses: regenerate userId, retry once
    - Implement error banner display for failed operations
    - Wire task completion/deletion to trigger top-three regeneration
    - _Requirements: 1.4, 2.2, 3.3, 4.5, 5.1, 6.2, 6.4, 8.5_

  - [~] 11.2 Set up AWS infrastructure configuration
    - Create DynamoDB table definition with GSI1 configuration
    - Configure Lambda function with Bedrock permissions and DynamoDB access
    - Configure API Gateway REST API with API key requirement and CORS
    - Set up Amplify Hosting configuration for frontend deployment
    - _Requirements: 8.1, 8.3, 9.1, 9.5_

  - [ ]* 11.3 Write integration tests
    - Test full task lifecycle: create → AI enrichment → complete → restore → delete
    - Test API routing with valid/invalid API keys
    - Test DynamoDB operations with mocked AWS SDK
    - Test recalculation endpoint updates all task scores
    - Test top-three regeneration after task completion/deletion
    - _Requirements: 8.1, 8.2, 4.5, 6.4, 3.4_

- [~] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The "write-then-enrich" pattern means task creation always succeeds immediately with defaults, even if AI fails
- All backend modules are in a single Lambda deployment package for minimal cold starts
- Frontend uses optimistic updates for responsive UX with rollback on failure

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "2.5"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6", "3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "7.1", "7.2"] },
    { "id": 7, "tasks": ["7.3", "9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 9, "tasks": ["11.1", "11.2"] },
    { "id": 10, "tasks": ["11.3"] }
  ]
}
```
