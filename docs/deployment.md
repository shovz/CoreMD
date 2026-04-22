# CoreMD Deployment Runbook

Deploy CoreMD to AWS: React SPA on S3+CloudFront, FastAPI backend on EC2 t3.micro, MongoDB Atlas M0.

**Cost:** ~$0 first 12 months (free tier), then ~$9/mo.

---

## Prerequisites (one-time setup — do these before anything else)

- [ ] AWS account created, AWS CLI installed and configured (`aws sts get-caller-identity` works)
- [ ] MongoDB Atlas M0 cluster created, DB user + connection string saved
- [ ] EC2 key pair `coremd-key` downloaded to `~/.ssh/coremd-key.pem`, permissions set (`chmod 400`)

---

## Step 1 — Deploy Frontend Infrastructure (S3 + CloudFront)

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation/01-frontend.yml \
  --stack-name coremd-frontend \
  --region us-east-1
```

Takes ~5 minutes. When done, get the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name coremd-frontend \
  --query "Stacks[0].Outputs" \
  --output table
```

**Save these values — you'll need them in later steps:**
- `BucketName` → e.g. `coremd-frontend-frontendbucket-abc123`
- `CloudFrontDomain` → e.g. `https://d1abc123.cloudfront.net` ← your app URL
- `DistributionId` → e.g. `E1ABC123XYZ`

---

## Step 2 — Deploy EC2 Backend

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation/02-ec2.yml \
  --stack-name coremd-backend \
  --parameter-overrides KeyName=coremd-key \
  --region us-east-1
```

Takes ~3 minutes. Get the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name coremd-backend \
  --query "Stacks[0].Outputs" \
  --output table
```

**Save:**
- `PublicIP` → e.g. `54.12.34.56` ← your EC2 IP

---

## Step 3 — Set Up the EC2 Instance

SSH in (wait ~2 minutes after stack creation for UserData to finish):

```bash
ssh -i ~/.ssh/coremd-key.pem ec2-user@<PUBLIC_IP>
```

Clone the repo:

```bash
git clone https://github.com/<your-username>/CoreMD.git ~/CoreMD
```

Create the production environment file:

```bash
cp ~/CoreMD/infra/env/.env.production.example ~/CoreMD/infra/env/.env.production
nano ~/CoreMD/infra/env/.env.production
```

Fill in your values:

```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/CoreMD
REDIS_URL=redis://redis:6379
JWT_SECRET=<run: openssl rand -hex 32  and paste the result>
JWT_ALGORITHM=HS256
OPENAI_API_KEY=sk-...
```

Create the images directory:

```bash
mkdir -p ~/CoreMD/backend/static/images
```

---

## Step 4 — Start the Backend

From your local machine (Git Bash):

```bash
bash infra/scripts/deploy_backend.sh <PUBLIC_IP> ~/.ssh/coremd-key.pem
```

Verify it's healthy:

```bash
curl http://<PUBLIC_IP>:8000/health
# → {"status":"ok"}
```

---

## Step 5 — Sync Images to EC2

The 3,621 extracted images are not in git (400MB). Sync them from your local machine:

```bash
bash infra/scripts/sync_images.sh <PUBLIC_IP> ~/.ssh/coremd-key.pem
```

First run takes a few minutes (400MB). Subsequent runs only sync changes.

---

## Step 6 — Migrate MongoDB Data to Atlas

Your local MongoDB data needs to be copied to Atlas.

Export from local Docker MongoDB (make sure containers are running):

```bash
cd infra && docker-compose up -d mongo
mongodump --uri="mongodb://localhost:27017/CoreMD" --out=dump/
```

Import to Atlas:

```bash
mongorestore --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/CoreMD" dump/CoreMD/
```

---

## Step 7 — Deploy the Frontend

```bash
bash infra/scripts/deploy_frontend.sh <BUCKET_NAME> <DIST_ID> <PUBLIC_IP>
```

This builds React with the correct API URL baked in, uploads to S3, and invalidates the CloudFront cache.

---

## Step 8 — Verify

Open your CloudFront URL (e.g. `https://d1abc123.cloudfront.net`) in a browser.

- Login / register should work
- Chapters list should load
- Section detail should show text and inline images

---

## Re-deploying After Code Changes

**Backend only:**
```bash
bash infra/scripts/deploy_backend.sh <PUBLIC_IP> ~/.ssh/coremd-key.pem
```

**Frontend only:**
```bash
bash infra/scripts/deploy_frontend.sh <BUCKET_NAME> <DIST_ID> <PUBLIC_IP>
```

**Both:**
```bash
bash infra/scripts/deploy_backend.sh <PUBLIC_IP> ~/.ssh/coremd-key.pem
bash infra/scripts/deploy_frontend.sh <BUCKET_NAME> <DIST_ID> <PUBLIC_IP>
```

---

## Teardown (Stop All AWS Resources)

```bash
aws cloudformation delete-stack --stack-name coremd-backend --region us-east-1
aws cloudformation delete-stack --stack-name coremd-frontend --region us-east-1
```

Note: the S3 bucket must be emptied before the frontend stack can be deleted:
```bash
aws s3 rm s3://<BUCKET_NAME> --recursive
aws cloudformation delete-stack --stack-name coremd-frontend --region us-east-1
```
