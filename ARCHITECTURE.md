# Architecture Document — PriorityLens

## 1. System Overview

PriorityLens is a serverless, AI-powered task management application built entirely on AWS. It uses the Eisenhower Matrix framework to automatically categorize and prioritize tasks through Amazon Bedrock's Nova Micro AI model.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              USER                                          │
│                         (Browser / Mobile)                                 │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        AWS AMPLIFY HOSTING                                 │
│  React 19 SPA | Static Assets (HTML, CSS, JS) | CDN Distribution         │
│  Security Headers: HSTS, X-Frame-Options, X-Content-Type-Options          │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      AMAZON API GATEWAY (REST)                             │
│                                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │  API Key    │  │  Usage Plan  │  │         CORS Config             │ │
│  │  Validation │  │  Rate Limit  │  │  Allow: GET,POST,PATCH,DELETE   │ │
│  │             │  │  100 req/s   │  │  Headers: Content-Type,         │ │
│  │             │  │  Burst: 50   │  │           x-api-key, x-user-id  │ │
│  │             │  │  10K/day     │  │                                 │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────────────┘ │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ Lambda Proxy Integration
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        AWS LAMBDA FUNCTION                                 │
│                 (Node.js 20.x | 256MB | 30s timeout)                      │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                      handler.ts (Router)                          │    │
│  │  OPTIONS → CORS preflight                                         │    │
│  │  POST /tasks → handleCreateTask                                   │    │
│  │  GET /tasks → handleGetTasks                                      │    │
│  │  PATCH /tasks/{id}/complete → handleCompleteTask                  │    │
│  │  PATCH /tasks/{id}/incomplete → handleIncompleteTask              │    │
│  │  DELETE /tasks/{id} → handleDeleteTask                            │    │
│  │  POST /tasks/top-three → handleTopThree                           │    │
│  │  POST /tasks/recalculate → handleRecalculate                      │    │
│  └───────────┬──────────────────────────────────────────────────────┘    │
│              │                                                             │
│  ┌───────────▼──────────────────────────────────────────────────────┐    │
│  │                    taskService.ts (Orchestrator)                   │    │
│  │                                                                    │    │
│  │  Write-Then-Enrich Pattern:                                        │    │
│  │  1. Validate inputs (validator.ts)                                 │    │
│  │  2. Save task with defaults → DynamoDB                             │    │
│  │  3. Invoke AI → Bedrock                                           │    │
│  │  4. Update task with AI results → DynamoDB                         │    │
│  │  5. On AI failure → retain defaults (graceful degradation)         │    │
│  └───────────┬───────────────────────────────┬──────────────────────┘    │
│              │                               │                            │
│  ┌───────────▼──────────┐       ┌───────────▼──────────────────────┐    │
│  │   dbService.ts       │       │     aiService.ts                  │    │
│  │                      │       │                                    │    │
│  │  • createTask        │       │  • buildPrompt (Eisenhower rules) │    │
│  │  • getTasksByUser    │       │  • invokeBedrock (Nova Micro)     │    │
│  │  • getIncomplete     │       │  • parseAiResponse (JSON parse)   │    │
│  │    ByScore (GSI1)    │       │  • 3 retries @ 5s intervals       │    │
│  │  • updateTask        │       │  • Circuit breaker (3 failures    │    │
│  │  • deleteTask        │       │    → 60s cooldown)                │    │
│  │  • 1 retry @ 2s     │       │  • Default fallback on failure    │    │
│  └───────────┬──────────┘       └───────────┬──────────────────────┘    │
│              │                               │                            │
└──────────────┼───────────────────────────────┼────────────────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────┐    ┌────────────────────────────────────────┐
│    AMAZON DYNAMODB       │    │        AMAZON BEDROCK                   │
│                          │    │                                          │
│  Table: ai-smart-todo    │    │  Model: amazon.nova-micro-v1:0          │
│  Billing: PAY_PER_REQUEST│    │  Input: ~300 tokens/call                │
│                          │    │  Output: ~100 tokens/call               │
│  Primary Key:            │    │  Latency: ~300-500ms                    │
│    PK = USER#{userId}    │    │                                          │
│    SK = TASK#{taskId}    │    │  Returns:                               │
│                          │    │    • quadrant (do-first/schedule/        │
│  GSI1 (Score Index):     │    │      delegate/eliminate)                 │
│    GSI1PK = USER#{userId}│    │    • priorityScore (1-100)              │
│      #STATUS#incomplete  │    │    • reasoning (text)                    │
│    GSI1SK = SCORE#XXX    │    │                                          │
│    (zero-padded, DESC)   │    └────────────────────────────────────────┘
│                          │
└──────────────────────────┘
```
<img width="1536" height="1024" alt="high level architecture" src="https://github.com/user-attachments/assets/483e6160-7a7d-4ec6-a46e-f4728ccb7853" />

---

## 2. Data Flow

### 2.1 Create Task Flow

```
User types task → [Frontend] → POST /tasks (x-api-key, x-user-id)
                                    │
                                    ▼
                            [API Gateway validates API key]
                                    │
                                    ▼
                            [Lambda: handler.ts]
                                    │
                                    ▼
                            [validator.ts: validate body + userId]
                                    │
                                    ▼
                            [taskService.ts: createTask()]
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                   [dbService: save       [aiService: categorize
                    with defaults]         AndScore()]
                   (quadrant=schedule,         │
                    score=50)              [Bedrock: Nova Micro]
                          │                   │
                          │              ┌────┴────┐
                          │              ▼         ▼
                          │         [Success]  [Failure]
                          │              │         │
                          │              ▼         ▼
                          │         [dbService:  [Return task
                          │          update      with defaults]
                          │          with AI]
                          │              │
                          ▼              ▼
                   [Return task response to frontend]
                                    │
                                    ▼
                   [Frontend: add to Zustand store → re-render]
```

<img width="1086" height="1448" alt="Create task flow" src="https://github.com/user-attachments/assets/d17e4a39-5084-4316-bfaa-8125e386255a" />

### 2.2 Optimistic Update Pattern (Frontend)

```
User clicks "Complete" → [Zustand: immediately update UI]
                              │
                              ├──── (Success) → Keep new state
                              │
                              └──── (Failure) → Rollback to previous state
                                                 Show error banner
```

---

## 3. DynamoDB Data Model

### Single-Table Design

| Attribute | Example | Purpose |
|-----------|---------|---------|
| `PK` | `USER#a1b2c3d4-...` | Partition key (user scope) |
| `SK` | `TASK#e5f6g7h8-...` | Sort key (task identifier) |
| `GSI1PK` | `USER#a1b2c3d4-...#STATUS#incomplete` | Query incomplete tasks by user |
| `GSI1SK` | `SCORE#087` | Sort by priority score (descending) |
| `description` | "Submit quarterly report" | Task text (1-500 chars) |
| `quadrant` | `do-first` | AI-assigned Eisenhower quadrant |
| `priorityScore` | 87 | AI-assigned priority (1-100) |
| `status` | `incomplete` | Current status |
| `createdAt` | `2025-01-15T10:30:00Z` | Creation timestamp |
| `completedAt` | `null` or ISO string | Completion timestamp |
| `aiProcessed` | `true` | Whether AI has enriched this task |

### Access Patterns

| Pattern | Key Condition | Index |
|---------|--------------|-------|
| Get all tasks for user | PK = USER#{userId} | Table |
| Get incomplete tasks sorted by score | GSI1PK = USER#{userId}#STATUS#incomplete | GSI1 (DESC) |

---

## 4. AI Prompt Strategy

The AI prompt is engineered to return structured JSON with three fields:

```
┌─────────────────────────────────────────────┐
│ PROMPT STRUCTURE                             │
├─────────────────────────────────────────────┤
│ 1. Task description                          │
│ 2. Quadrant classification rules:            │
│    • do-first = urgent AND important         │
│    • schedule = important, NOT urgent        │
│    • delegate = urgent, NOT important        │
│    • eliminate = neither                      │
│ 3. Scoring rules (1-100):                    │
│    • Base range per quadrant                 │
│    • Adjustments for deadlines/specificity   │
│ 4. Context: task count + current date        │
│ 5. Output format: JSON only                  │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│ AI RESPONSE                                  │
├─────────────────────────────────────────────┤
│ {                                            │
│   "quadrant": "do-first",                   │
│   "priorityScore": 92,                      │
│   "reasoning": "Deadline tomorrow,           │
│                 impacts quarterly goals"      │
│ }                                            │
└─────────────────────────────────────────────┘
```

<img width="1536" height="1024" alt="AI prompt strategy" src="https://github.com/user-attachments/assets/31514d5f-abcf-4650-bc2f-775aac28620b" />

---

## 5. Frontend Architecture

### Component Tree

```
<App>
  ├── <Header />                    ← Sticky navbar + theme toggle
  ├── <main className="app">
  │     ├── <ErrorBanner />         ← Non-blocking error alerts
  │     ├── <div.app__hero>         ← Title + subtitle
  │     ├── <TaskInput />           ← Task entry form
  │     ├── <TopThreePanel />       ← AI-recommended top 3
  │     ├── <QuadrantView />        ← 2×2 Eisenhower grid
  │     └── <CompletedSection />    ← Collapsible completed tasks
  └── <Footer />                    ← App footer
```

### State Architecture

```
┌──────────────────────────────────────┐
│          useAppStore (Zustand)        │
├──────────────────────────────────────┤
│ State:                                │
│   tasks: Task[]                       │
│   topThree: string[]                  │
│   isLoading: boolean                  │
│   error: string | null                │
│   userId: string                      │
├──────────────────────────────────────┤
│ Actions:                              │
│   loadTasks() → GET /tasks            │
│   addTask(desc) → POST /tasks         │
│   completeTask(id) → PATCH .../complete│
│   restoreTask(id) → PATCH .../incomplete│
│   deleteTask(id) → DELETE /tasks/{id} │
│   refreshTopThree() → POST /top-three │
│   clearError()                        │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│        useThemeStore (Zustand)        │
├──────────────────────────────────────┤
│ State:                                │
│   mode: 'light' | 'dark' | 'system'  │
├──────────────────────────────────────┤
│ Actions:                              │
│   setMode(mode) → localStorage +     │
│     data-theme attribute              │
└──────────────────────────────────────┘
```

### Theme System

```
index.html (anti-flash script)
         │
         ▼ Sets data-theme before paint
┌────────────────────────────────────────┐
│ CSS Custom Properties (80+ tokens)      │
│                                          │
│ [data-theme='light'] { ... }            │
│ [data-theme='dark']  { ... }            │
│                                          │
│ Colors, shadows, radii, spacing,         │
│ glassmorphism, transitions               │
└────────────────────────────────────────┘
         │
         ▼ Applied via var(--token)
┌────────────────────────────────────────┐
│ Component CSS (App.css)                  │
│ Smooth transitions between themes        │
│ (var(--transition-slow) = 350ms)         │
└────────────────────────────────────────┘
```

---

## 6. Security

| Layer | Mechanism |
|-------|-----------|
| API Authentication | API Key (x-api-key header) validated by API Gateway |
| User Identification | UUID v4 (x-user-id header) — anonymous, client-generated |
| Rate Limiting | API Gateway: 100 req/s sustained, 50 burst, 10K/day quota |
| Input Validation | Server-side validation of all inputs (lengths, formats) |
| CORS | Configured at API Gateway level with specific headers |
| Frontend Hosting | HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| Data Isolation | Each user's data partitioned by userId in DynamoDB PK |

<img width="262" height="509" alt="security layer" src="https://github.com/user-attachments/assets/7afedc71-c3e8-4cc4-a7ab-c07db5d08721" />

---

## 7. Resilience Patterns

| Pattern | Implementation |
|---------|---------------|
| Write-then-enrich | Task saved before AI call; user isn't blocked |
| Retry (Backend) | DynamoDB: 1 retry @ 2s; Bedrock: 3 retries @ 5s |
| Circuit Breaker | AI calls stop after 3 failures; 60s recovery window |
| Graceful Degradation | App works without AI (default quadrant + score) |
| Optimistic UI | Frontend updates instantly, rolls back on failure |
| Client Retry | Frontend schedules re-fetch after AI_UNAVAILABLE (503) |

---

## 8. Deployment Pipeline

```
Developer pushes to Git
         │
         ▼
┌────────────────────┐     ┌────────────────────────────┐
│ Backend (Manual)    │     │ Frontend (Auto via Amplify) │
│                    │     │                            │
│ sam build          │     │ amplify.yml:               │
│ sam deploy         │     │   npm ci                   │
│                    │     │   npm run build            │
│ Deploys:           │     │   dist/ → CDN             │
│  • Lambda          │     │                            │
│  • API Gateway     │     │ Security headers auto-     │
│  • DynamoDB        │     │ applied on all responses   │
│  • API Key         │     │                            │
└────────────────────┘     └────────────────────────────┘
```

---

## 9. Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Frontend bundle | ~207KB (65KB gzipped) | React + Zustand + app code |
| CSS bundle | ~19KB (4KB gzipped) | All styles including theme tokens |
| Cold start (Lambda) | ~300-500ms | Node.js 20 + SDK v3 |
| Warm invocation | ~50-100ms | Excluding Bedrock latency |
| Bedrock latency | ~300-500ms | Nova Micro (fast model) |
| DynamoDB read | <10ms | Single-digit ms with on-demand |
| End-to-end (create task) | ~500-800ms | Including AI enrichment |
| Theme switch | Instant | CSS transitions, no re-render |
| Optimistic updates | <16ms | Single frame, no network wait |

---

## 10. Future Enhancements

- **Authentication** — Migrate from anonymous UUIDs to Amazon Cognito
- **Recurring tasks** — Scheduled Lambda for daily task generation
- **Natural language dates** — Parse "by Friday" into deadline fields
- **Collaboration** — Share quadrant views with team members
- **Mobile app** — React Native with shared types
- **Offline mode** — Service worker + IndexedDB for offline task creation
- **Analytics** — Track productivity patterns over time
