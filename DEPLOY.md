# Deployment Guide

## Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) configured with credentials
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node.js 20.x
- An AWS account with Bedrock access enabled for Claude 3 Haiku in your region

## Backend Deployment (SAM)

### 1. Build

```bash
cd ai-smart-todo
sam build
```

### 2. Deploy (first time)

```bash
sam deploy --guided
```

This will prompt for:
- Stack name (default: `ai-smart-todo`)
- AWS Region
- Parameter overrides (Environment, FrontendOrigin)
- Confirm changeset before deploy

### 3. Deploy (subsequent)

```bash
sam deploy
```

### 4. Production deployment

```bash
sam deploy --config-env prod
```

Update the `FrontendOrigin` parameter in `samconfig.toml` under `[prod.deploy.parameters]` with your actual Amplify domain.

### 5. Get API Key value

After deployment, retrieve your API key value:

```bash
# Get the API Key ID from stack outputs
aws cloudformation describe-stacks --stack-name ai-smart-todo --query "Stacks[0].Outputs[?OutputKey=='ApiKeyId'].OutputValue" --output text

# Get the actual API key value using the ID
aws apigateway get-api-key --api-key <API_KEY_ID> --include-value --query "value" --output text
```

### 6. Get API URL

```bash
aws cloudformation describe-stacks --stack-name ai-smart-todo --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

## Frontend Deployment (Amplify Hosting)

### Option A: AWS Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click "New app" > "Host web app"
3. Connect your Git repository
4. Set the app root to `ai-smart-todo/frontend`
5. Amplify will detect the `amplify.yml` build spec automatically
6. Add environment variables:
   - `VITE_API_URL` = your API Gateway URL from step 6 above
   - `VITE_API_KEY` = your API key value from step 5 above
7. Deploy

### Option B: Amplify CLI

```bash
cd frontend

# Install Amplify CLI if needed
npm install -g @aws-amplify/cli

# Initialize (follow prompts)
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

## Environment Variables

### Backend (Lambda)

Set automatically by SAM template:
- `TABLE_NAME` - DynamoDB table name
- `AWS_NODEJS_CONNECTION_REUSE_ENABLED` - Connection reuse optimization

### Frontend

Create `frontend/.env.production`:

```env
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/dev
VITE_API_KEY=<your-api-key-value>
```

## Local Development

### Backend (SAM Local)

```bash
# Start local API (requires Docker)
sam local start-api

# Invoke function directly
sam local invoke TodoFunction --event events/create-task.json
```

### Frontend

```bash
cd frontend
npm run dev
```

## Cleanup

Remove all resources:

```bash
sam delete --stack-name ai-smart-todo
```

## Architecture Notes

- **DynamoDB**: Uses PAY_PER_REQUEST billing (no pre-provisioned capacity). Stays within Free Tier for low-traffic use.
- **Lambda**: Single function handles all routes. 256MB memory, 30s timeout.
- **API Gateway**: REST API with API key authentication. Rate limited to 100 req/s burst 50.
- **Bedrock**: Requires model access to be enabled in your AWS account for `anthropic.claude-3-haiku-20240307-v1:0`.
