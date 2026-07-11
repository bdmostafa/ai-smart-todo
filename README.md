# AI Smart Todo

> Your AI-powered daily productivity companion. Organize, prioritize, and conquer your tasks with the Eisenhower Matrix — powered by Amazon Bedrock AI.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-20.x-green)
![React](https://img.shields.io/badge/react-19-blue)
![AWS](https://img.shields.io/badge/cloud-AWS-orange)

---

## Overview

AI Smart Todo is a full-stack serverless productivity application that uses AI to automatically categorize and prioritize your tasks using the Eisenhower Matrix framework. Simply describe what you need to do — the AI handles the rest.

**Key Features:**
- 🧠 AI-powered task classification (Urgent/Important quadrants)
- 📊 Priority scoring (1-100) with intelligent ranking
- ✨ "Today's Top 3" — AI-recommended daily focus tasks
- 🌓 Dark / Light / System theme with smooth transitions
- 📱 Fully responsive mobile-first design
- ⚡ Serverless architecture — scales to zero, pay only for what you use
- 🔄 Optimistic UI updates with automatic rollback on failure

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React 19 + TypeScript + Vite                             │  │
│  │  Zustand (State Management) | CSS Custom Properties       │  │
│  │  Dark/Light/System Theme | Glassmorphism UI               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                    Hosted on AWS Amplify                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS (API Key + User ID headers)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (REST)                           │
│  • API Key Authentication                                        │
│  • Rate Limiting: 100 req/s, burst 50, 10K/day quota            │
│  • CORS configured                                               │
│  • GatewayResponses for 4xx/5xx CORS headers                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AWS LAMBDA (Node.js 20.x)                    │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  handler   │→ │ taskService  │→ │    aiService           │  │
│  │  (router)  │  │ (orchestrate)│  │ (Bedrock + retries +   │  │
│  └────────────┘  └──────────────┘  │  circuit breaker)      │  │
│        │                │           └────────────────────────┘  │
│        │                │                      │                 │
│        ▼                ▼                      ▼                 │
│  ┌──────────┐   ┌────────────┐     ┌──────────────────────┐   │
│  │validator │   │  dbService │     │  Amazon Bedrock      │   │
│  │middleware│   │ (DynamoDB) │     │  (Nova Micro v1)     │   │
│  └──────────┘   └────────────┘     └──────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AMAZON DYNAMODB                                │
│  Single-Table Design | PAY_PER_REQUEST billing                   │
│                                                                  │
│  PK: USER#{userId}           SK: TASK#{taskId}                  │
│  GSI1PK: USER#{userId}#STATUS#incomplete                        │
│  GSI1SK: SCORE#{priorityScore (zero-padded)}                    │
└─────────────────────────────────────────────────────────────────┘
```

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/f553353c-fd3f-4043-8b59-3f7109145f7b" />


---

### Component Breakdown

#### Frontend (React SPA)

| Component | Purpose |
|-----------|---------|
| `Header` | Sticky glassmorphism navbar with logo and dark/light/system theme toggle |
| `TaskInput` | Task entry form with validation (1-500 chars), character counter |
| `TopThreePanel` | AI-recommended top 3 priority tasks with complete/delete actions |
| `QuadrantView` | 2×2 Eisenhower Matrix grid showing tasks by quadrant |
| `TaskCard` | Individual task display with toggle complete/delete + confirmation |
| `CompletedSection` | Collapsible section showing completed tasks with restore option |
| `ErrorBanner` | Non-blocking error alerts with dismiss |
| `Footer` | Minimal app footer |

**State Management:** Zustand store with optimistic updates and automatic rollback on API failures.

**Theme System:** CSS custom properties with `data-theme` attribute. Anti-flash script in HTML prevents FOUC on page load. Persisted to localStorage.

#### Backend (Serverless Lambda)

| Module | Responsibility |
|--------|---------------|
| `handler.ts` | Lambda entry point, request routing, CORS, response building |
| `taskService.ts` | Business logic orchestration, write-then-enrich pattern |
| `aiService.ts` | Bedrock integration, prompt engineering, retry + circuit breaker |
| `dbService.ts` | DynamoDB data access layer with single-table design |
| `scorer.ts` | Priority scoring, top-three selection, quadrant ordering |
| `validator.ts` | Input validation (descriptions, UUIDs, request bodies) |
| `middleware.ts` | API key authorization |

#### AI Integration Details

**Model:** Amazon Nova Micro v1 (`amazon.nova-micro-v1:0`) via Amazon Bedrock

**Pattern: Write-Then-Enrich**
1. Task is saved to DynamoDB immediately with defaults (quadrant: "schedule", score: 50)
2. Bedrock is invoked asynchronously for AI categorization
3. On success → task updated with AI results
4. On failure → task retains defaults, client schedules retry

**Resilience:**
- 3 automatic retries with 5-second intervals
- Circuit breaker: opens after 3 consecutive failures, 60-second cooldown
- Graceful degradation: app remains functional even when AI is unavailable

**Prompt Engineering:**
- Eisenhower Matrix quadrant classification rules
- Priority scoring rules (1-100) with scoring adjustments
- Context injection: task count, current date
- Structured JSON output format enforcement

---

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/tasks` | Create a new task (triggers AI categorization) |
| `GET` | `/tasks` | Get all tasks + top three recommendations |
| `PATCH` | `/tasks/{taskId}/complete` | Mark task as complete |
| `PATCH` | `/tasks/{taskId}/incomplete` | Restore task to incomplete |
| `DELETE` | `/tasks/{taskId}` | Permanently delete a task |
| `POST` | `/tasks/top-three` | Refresh top-three recommendations |
| `POST` | `/tasks/recalculate` | Re-invoke AI for all incomplete tasks |

**Authentication:** API Key via `x-api-key` header + user identification via `x-user-id` header (UUID v4).

---

### Infrastructure (AWS SAM)

| Resource | AWS Service | Configuration |
|----------|-------------|---------------|
| TodoTable | DynamoDB | PAY_PER_REQUEST, single-table with GSI1 |
| TodoFunction | Lambda | Node.js 20.x, 256MB, 30s timeout |
| TodoApi | API Gateway REST | API Key + Usage Plan |
| TodoApiKey | API Key | Scoped to usage plan |
| TodoUsagePlan | Usage Plan | 100 req/s, burst 50, 10K/day |
| Frontend | Amplify Hosting | Auto-deploy from Git, security headers |

---

## Cost Breakdown

### Scenario: Single User, 1,000 Tasks per Month

This estimates the monthly AWS cost for one active user creating 1,000 tasks/month with typical usage patterns.

#### Assumptions

| Metric | Value | Reasoning |
|--------|-------|-----------|
| New tasks created | 1,000/month | User input |
| GET /tasks calls | 3,000/month | ~3 page loads/day × 30 days |
| Task completions | 800/month | 80% completion rate |
| Task deletions | 100/month | 10% cleanup |
| Top-three refreshes | 1,800/month | On each complete/delete |
| Recalculate calls | 30/month | Once daily |
| Total API calls | ~6,730/month | Sum of all endpoints |
| Total Lambda invocations | ~6,730/month | 1 invocation per API call |
| Avg Lambda duration | 500ms | Including Bedrock latency |
| Bedrock invocations | ~1,030/month | 1,000 creates + 30 recalculates |
| DynamoDB reads (RCU) | ~8,800/month | ~1.3 per GET/top-three/recalculate |
| DynamoDB writes (WCU) | ~2,900/month | Create + update + complete + delete |
| Data storage | < 1 MB | 1,000 tasks × ~500 bytes each |

#### Monthly Cost Estimate

| Service | Free Tier | Usage | Monthly Cost |
|---------|-----------|-------|-------------|
| **AWS Lambda** | 1M requests + 400K GB-s free | 6,730 invocations × 500ms × 256MB = ~0.86 GB-s | **$0.00** (within free tier) |
| **API Gateway** | 1M calls free (12 months) | 6,730 calls | **$0.00** (within free tier) |
| **DynamoDB** | 25 RCU + 25 WCU always free | ~8,800 reads + 2,900 writes (on-demand) | **$0.00** (within free tier¹) |
| **Amazon Bedrock (Nova Micro)** | No free tier | ~1,030 calls × ~300 input tokens × ~100 output tokens | **~$0.05²** |
| **Amplify Hosting** | 1000 build min + 15GB served | Static SPA, minimal builds | **$0.00** (within free tier) |
| **Data Transfer** | 100GB/month free | < 100MB | **$0.00** |
| **CloudWatch Logs** | 5GB free | Minimal logging | **$0.00** |

| | | **Total Estimated** | **~$0.05/month** |
|-|-|-|-|

> ¹ DynamoDB on-demand provides 25 RCU/WCU of always-free capacity equivalent. For 1,000 tasks/month the usage is well within this.
>
> ² Amazon Nova Micro pricing: $0.000035/1K input tokens + $0.00014/1K output tokens. At ~300 input + 100 output tokens per call × 1,030 calls = ~$0.05/month.

#### Scaling Scenarios

| Users × Tasks | Lambda | DynamoDB | Bedrock | API Gateway | **Total/month** |
|---------------|--------|----------|---------|-------------|-----------------|
| 1 × 1,000 | $0.00 | $0.00 | $0.05 | $0.00 | **~$0.05** |
| 10 × 1,000 | $0.00 | $0.00 | $0.50 | $0.00 | **~$0.50** |
| 100 × 1,000 | $0.00 | $0.15 | $5.00 | $0.00 | **~$5.15** |
| 1,000 × 1,000 | $0.02 | $1.50 | $50.00 | $3.50 | **~$55.02** |
| 10,000 × 1,000 | $0.80 | $15.00 | $500.00 | $35.00 | **~$550.80** |

> Note: After the 12-month AWS Free Tier expires, API Gateway adds ~$3.50/million calls. Lambda and DynamoDB have always-free tiers that never expire.

#### Cost Optimization Tips

1. **Bedrock is the primary cost driver** — Consider caching AI results for identical/similar task descriptions
2. **Batch recalculates** — Limit automatic recalculation frequency
3. **DynamoDB** — PAY_PER_REQUEST is ideal for variable traffic; switch to provisioned at steady-state high scale
4. **Lambda** — 256MB is optimal for this workload; ARM64 (Graviton) would save 20%
5. **API Gateway** — Consider HTTP API (cheaper) if you don't need API Key plans

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 6, Vite 8, Zustand 5 |
| Styling | CSS Custom Properties, Inter font, Glassmorphism |
| Backend | Node.js 20, TypeScript, AWS Lambda |
| AI | Amazon Bedrock (Nova Micro v1) |
| Database | Amazon DynamoDB (Single-table design) |
| Infrastructure | AWS SAM (CloudFormation) |
| Hosting | AWS Amplify |
| CI/CD | Amplify auto-deploy from Git |
| Auth | API Key + UUID-based user identification |

---

## Getting Started

### Prerequisites

- Node.js 20.x
- AWS CLI configured with credentials
- AWS SAM CLI
- AWS account with Bedrock access enabled for Nova Micro

### Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173

# Backend (requires Docker for SAM local)
cd backend
npm install
npm run build
sam local start-api
```

### Environment Variables

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
VITE_API_KEY=your-api-key-here
```

### Running Tests

```bash
# Frontend (105 tests)
cd frontend && npm test

# Backend
cd backend && npm test
```

---

## Deployment

### Backend (SAM)

```bash
# Build and deploy
sam build
sam deploy --guided  # First time
sam deploy           # Subsequent
```

### Frontend (Amplify)

1. Connect your Git repo in the [Amplify Console](https://console.aws.amazon.com/amplify)
2. Set app root to `ai-smart-todo/frontend`
3. Add environment variables: `VITE_API_URL` and `VITE_API_KEY`
4. Deploy automatically on push

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

---

## Project Structure

```
ai-smart-todo/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── components/          # UI components (Header, TaskInput, QuadrantView, etc.)
│   │   ├── store/               # Zustand stores (app state + theme)
│   │   ├── lib/                 # API client, userId utilities
│   │   ├── test/                # Test setup
│   │   ├── App.tsx              # Main app shell
│   │   ├── App.css              # Component styles
│   │   ├── index.css            # Design tokens & theme variables
│   │   └── types.ts             # TypeScript types
│   ├── index.html               # Entry HTML with anti-flash theme script
│   └── package.json
├── backend/                     # Serverless Lambda
│   ├── src/
│   │   ├── handler.ts           # Lambda entry + routing
│   │   ├── taskService.ts       # Business logic
│   │   ├── aiService.ts         # Bedrock AI integration
│   │   ├── dbService.ts         # DynamoDB data layer
│   │   ├── scorer.ts            # Priority scoring
│   │   ├── validator.ts         # Input validation
│   │   ├── middleware.ts        # API key auth
│   │   └── types.ts             # TypeScript types
│   └── package.json
├── template.yaml                # AWS SAM infrastructure template
├── amplify.yml                  # Amplify build spec
└── README.md                    # This file
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single Lambda for all routes | Simpler deployment, shared cold start, sufficient for this scale |
| DynamoDB single-table | Efficient access patterns, no joins needed, minimal cost |
| Write-then-enrich pattern | Non-blocking UX: user sees task instantly, AI enhances in background |
| Circuit breaker on AI | Prevents cascade failures when Bedrock is overloaded |
| Optimistic UI updates | Instant feedback, rolled back on error |
| CSS custom properties (no Tailwind) | Zero dependencies, full control, smaller bundle |
| Zustand over Redux | Minimal boilerplate, perfect for this app size |
| UUID-based user ID | Anonymous-first, no auth infrastructure needed for MVP |
| PAY_PER_REQUEST DynamoDB | Ideal for unpredictable traffic, no capacity planning |

---

## License

MIT
