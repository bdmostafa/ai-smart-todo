# Requirements Document

## Introduction

AI Smart To-Do with Priority Scoring is a personal productivity tool that eliminates the cognitive overhead of task management. Users dump all their tasks into a simple interface, and AI automatically categorizes each task using the Eisenhower Matrix (urgent/important quadrants), assigns a priority score, and suggests the top 3 tasks to focus on today. The goal is zero-complexity UX — genuinely useful without being overwhelming — deployable using AWS services within a weekend timeframe.

## Glossary

- **Application**: The AI Smart To-Do with Priority Scoring web application
- **User**: A person using the Application to manage personal tasks
- **Task**: A single to-do item created by the User containing a text description
- **Eisenhower_Matrix**: A decision-making framework that categorizes tasks into four quadrants based on urgency and importance: Do First (urgent + important), Schedule (not urgent + important), Delegate (urgent + not important), Eliminate (not urgent + not important)
- **Priority_Score**: A numerical score (1-100) assigned to a Task by the AI_Engine representing overall priority
- **AI_Engine**: The backend AI service (Amazon Bedrock) that analyzes, categorizes, and scores tasks
- **Task_Store**: The persistent storage layer (DynamoDB) holding all User tasks
- **Top_Three**: The AI-generated recommendation of the three highest-priority tasks for the current day
- **Backend_API**: The serverless API (Lambda + API Gateway) that handles requests between the frontend and AWS services

## Requirements

### Requirement 1: Task Creation

**User Story:** As a User, I want to quickly add tasks by typing text descriptions, so that I can dump all my to-dos without friction.

#### Acceptance Criteria

1. WHEN a User submits a text description, THE Application SHALL create a new Task and store it in the Task_Store
2. WHEN a Task is created, THE Application SHALL accept text descriptions between 1 and 500 characters in length, where leading and trailing whitespace is trimmed before character count validation and whitespace-only input is treated as empty
3. IF a User submits an empty description, a whitespace-only description, or one exceeding 500 characters after trimming, THEN THE Application SHALL display a validation error message indicating the allowed character range and SHALL NOT create a Task
4. WHEN a Task is successfully created, THE Application SHALL display the new Task in the User's task list within 2 seconds
5. WHEN a Task is successfully created, THE Application SHALL clear the text input field to allow immediate entry of another Task
6. IF the Task_Store fails to save a new Task, THEN THE Application SHALL display an error message indicating the Task was not saved and SHALL preserve the User's entered text description in the input field

### Requirement 2: AI Task Categorization

**User Story:** As a User, I want my tasks automatically categorized into Eisenhower Matrix quadrants, so that I can see which tasks are urgent and important without thinking about it.

#### Acceptance Criteria

1. WHEN a new Task is created, THE AI_Engine SHALL categorize the Task into exactly one Eisenhower_Matrix quadrant (Do First, Schedule, Delegate, or Eliminate) within 5 seconds of task submission
2. WHEN the AI_Engine categorizes a Task, THE Application SHALL display the assigned quadrant label alongside the Task
3. THE AI_Engine SHALL determine the quadrant based on analysis of the task description text, using time-related keywords (e.g., "today", "deadline", "ASAP", dates) as urgency indicators and outcome-related keywords (e.g., "goal", "project", "career", "health") as importance indicators
4. IF the AI_Engine fails to categorize a Task, THEN THE Backend_API SHALL assign the Task a default quadrant of "Schedule" and retry categorization up to 3 times with 5-second intervals between attempts
5. IF the AI_Engine fails to categorize a Task after all retry attempts are exhausted, THEN THE Backend_API SHALL retain the default "Schedule" quadrant assignment and notify the User that the categorization is pending manual review

### Requirement 3: AI Priority Scoring

**User Story:** As a User, I want each task scored by priority, so that I can instantly see which tasks matter most.

#### Acceptance Criteria

1. WHEN a new Task is created, THE AI_Engine SHALL assign an integer Priority_Score between 1 and 100 (inclusive) to the Task, where 100 represents the highest priority
2. THE AI_Engine SHALL calculate the Priority_Score by weighting the Eisenhower_Matrix quadrant (Do First > Schedule > Delegate > Eliminate), deadline or date references detected in the task description, and the relative position of the Task compared to other tasks in the User's task list
3. WHEN the AI_Engine assigns a Priority_Score, THE Application SHALL display the numeric score alongside the Task within 2 seconds of task creation
4. IF a User adds or removes tasks, THEN THE AI_Engine SHALL recalculate Priority_Scores for all remaining incomplete tasks within 5 seconds, ensuring each task's score reflects its updated rank relative to the current task list
5. IF the AI_Engine fails to assign a Priority_Score to a Task, THEN THE Backend_API SHALL assign a default Priority_Score of 50 to the Task and flag it for re-processing on the next recalculation cycle

### Requirement 4: Top Three Daily Recommendations

**User Story:** As a User, I want AI-suggested top 3 tasks for today, so that I can focus on what matters without decision fatigue.

#### Acceptance Criteria

1. WHEN a User opens the Application, THE AI_Engine SHALL generate a Top_Three recommendation from the User's incomplete tasks and return the result within 3 seconds
2. THE AI_Engine SHALL select Top_Three tasks by ranking all incomplete tasks by Priority_Score in descending order and selecting the top three, using time-sensitivity indicators for the current day as a tiebreaker
3. WHEN the Top_Three is generated, THE Application SHALL display the recommended tasks in a dedicated section positioned above the general task list, visually separated from other content
4. IF a User has fewer than three incomplete tasks, THEN THE Application SHALL display all remaining incomplete tasks as the daily recommendation, including an empty state message when zero incomplete tasks exist
5. WHEN a User completes a task from the Top_Three, THE AI_Engine SHALL regenerate the Top_Three within 3 seconds to include the next highest-priority incomplete task
6. IF the AI_Engine fails to generate the Top_Three, THEN THE Application SHALL display the three incomplete tasks with the highest Priority_Scores from the Task_Store as a fallback recommendation

### Requirement 5: Task Completion

**User Story:** As a User, I want to mark tasks as done, so that I can track my progress and clear completed items.

#### Acceptance Criteria

1. WHEN a User marks a Task as complete, THE Application SHALL update the Task status to "complete" in the Task_Store within 2 seconds
2. WHEN a Task is marked as complete, THE Application SHALL apply a strikethrough style to the task text and reduce its visual opacity to distinguish it from incomplete tasks
3. WHEN a Task is marked as complete, THE Application SHALL remove the Task from the Eisenhower_Matrix active view and Priority_Score rankings
4. THE Application SHALL display completed tasks in a separate "Completed" section below the active task list
5. WHEN a User marks a completed Task as incomplete, THE Application SHALL restore the Task to its original Eisenhower_Matrix quadrant and recalculate Priority_Scores

### Requirement 6: Task Deletion

**User Story:** As a User, I want to delete tasks I no longer need, so that I can keep my task list clean and relevant.

#### Acceptance Criteria

1. WHEN a User initiates Task deletion, THE Application SHALL display a confirmation prompt asking the User to confirm the deletion
2. WHEN a User confirms Task deletion, THE Application SHALL remove the Task from the Task_Store permanently within 2 seconds
3. WHEN a Task is deleted, THE Application SHALL remove the Task from all views including the Eisenhower_Matrix display and Top_Three recommendations
4. IF a deleted Task was part of the Top_Three, THEN THE AI_Engine SHALL regenerate the Top_Three to replace the deleted task within 3 seconds
5. IF the Task_Store fails to delete a Task, THEN THE Application SHALL display an error message indicating the deletion failed and SHALL retain the Task in all views

### Requirement 7: Task List Display

**User Story:** As a User, I want to see all my tasks organized clearly, so that I can get an overview of everything on my plate.

#### Acceptance Criteria

1. THE Application SHALL display all incomplete tasks grouped by their Eisenhower_Matrix quadrant in the order: Do First, Schedule, Delegate, Eliminate
2. WHILE displaying tasks within each quadrant, THE Application SHALL order tasks by Priority_Score in descending order (highest priority first), with ties broken by most recently created first
3. THE Application SHALL display each Task with its text description, Eisenhower_Matrix quadrant label, and Priority_Score
4. THE Application SHALL display all four Eisenhower_Matrix quadrants, showing a placeholder message in quadrants that contain no tasks
5. WHEN the task list is completely empty (no tasks in any quadrant), THE Application SHALL display a prompt inviting the User to add their first task

### Requirement 8: Serverless Backend API

**User Story:** As a developer, I want a serverless API handling all requests, so that the application scales automatically and stays within AWS Free Tier.

#### Acceptance Criteria

1. THE Backend_API SHALL expose RESTful endpoints for creating, reading, completing, and deleting tasks
2. WHEN the Backend_API receives a task creation request, THE Backend_API SHALL invoke the AI_Engine for categorization and scoring and return the complete response including AI results within 10 seconds
3. WHEN the Backend_API receives a request, THE Backend_API SHALL validate the request contains an API key header and that the key matches an authorized value before processing the request
4. IF a request is received without an API key or with an invalid API key, THEN THE Backend_API SHALL reject the request with a 401 Unauthorized response and not process the request further
5. IF the AI_Engine does not respond within 10 seconds or returns an error, THEN THE Backend_API SHALL return a 503 Service Unavailable response with a retry-after header value of 30 seconds
6. IF a request body fails validation due to missing required fields or invalid data types, THEN THE Backend_API SHALL return a 400 Bad Request response with an error message indicating which fields failed validation

### Requirement 9: Data Persistence

**User Story:** As a User, I want my tasks saved reliably, so that I do not lose my to-do list between sessions.

#### Acceptance Criteria

1. THE Task_Store SHALL persist all Task data including text description, Eisenhower_Matrix quadrant, Priority_Score, completion status, and creation timestamp
2. WHEN the Application loads, THE Backend_API SHALL retrieve all tasks belonging to the authenticated User from the Task_Store and return the complete task list within 3 seconds
3. IF a write operation to the Task_Store fails, THEN THE Backend_API SHALL retry the operation once within 2 seconds, preserve the User's local task state unchanged, and return an error message indicating the save failed if the retry also fails
4. IF a read operation to the Task_Store fails, THEN THE Backend_API SHALL retry the operation once within 2 seconds and return an error message indicating data could not be loaded if the retry also fails
5. THE Task_Store SHALL support storing up to 500 tasks per User

### Requirement 10: Simple User Identification

**User Story:** As a User, I want a simple way to access my personal task list, so that my tasks are private and persistent without complex sign-up flows.

#### Acceptance Criteria

1. WHEN a User first visits the Application and no user identifier exists in the browser local storage, THE Application SHALL generate a UUID v4 user identifier and store it in the browser local storage
2. WHEN a User returns to the Application and a valid user identifier exists in the browser local storage, THE Application SHALL use the stored identifier to retrieve the User's existing tasks from the Backend_API
3. THE Application SHALL include the user identifier in all Backend_API requests to scope data to the individual User
4. IF the browser local storage is cleared or the stored user identifier is not a valid UUID v4 format, THEN THE Application SHALL generate a new user identifier and present an empty task list
5. THE Application SHALL not require email, password, or any personal information for initial use
