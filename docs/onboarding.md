# Orbit — Quickstart & Onboarding Guide

## 1. Prerequisites
- Node.js 20+
- Docker and Docker Compose (optional for local full-stack run)
- PostgreSQL 16 (or run via Docker)

## 2. Quick Local Setup

### Option A: Local Dev with Docker Postgres
1. Start Postgres:
   ```bash
   docker run --name orbit-pg -e POSTGRES_USER=orbit -e POSTGRES_PASSWORD=orbit -e POSTGRES_DB=orbit -p 5432:5432 -d postgres:16-alpine
   ```

2. Generate an encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Set backend environment variables:
   ```bash
   export DATABASE_URL="postgresql://orbit:orbit@localhost:5432/orbit"
   export CREDENTIAL_ENCRYPTION_KEY="<your-generated-64-char-hex-key>"
   ```

4. Install & Run:
   ```bash
   npm install
   npm run dev
   ```

### Option B: Docker Compose (All-in-One)
```bash
docker compose -f docker/docker-compose.yml up --build
```
- Web UI: http://localhost:3000
- Backend API: http://localhost:4000

## 3. First Scan & Demo Mode
- **No AWS account yet?** Click **"Load Demo Architecture"** on the connection screen to inspect a full multi-tier production AWS VPC with EC2 instances, ALB, Lambda, RDS Aurora, S3, and subnets in interactive 2D and 3D!
- **Connecting your AWS Account:** Enter your Access Key ID and Secret Access Key. Ensure the IAM user has only the permissions in `docs/aws-iam-policy.json`.
