# CoreMD AWS Infrastructure — Manual Setup Guide

Everything CloudFormation does for CoreMD can be done by hand through the AWS Console.
This guide explains each component: what it is in general, why it exists in this app,
and exactly how to create it manually.

---

## Table of Contents

1. [S3 Bucket](#1-s3-bucket)
2. [Origin Access Control (OAC)](#2-origin-access-control-oac)
3. [CloudFront Function — SPA Routing](#3-cloudfront-function--spa-routing)
4. [CloudFront Distribution](#4-cloudfront-distribution)
5. [S3 Bucket Policy](#5-s3-bucket-policy)
6. [EC2 Key Pair](#6-ec2-key-pair)
7. [EC2 Security Group](#7-ec2-security-group)
8. [EC2 Instance](#8-ec2-instance)
9. [Elastic IP](#9-elastic-ip)

---

## 1. S3 Bucket

### What is it (general)?
S3 (Simple Storage Service) is AWS's object storage. You can store any file — images,
videos, backups, code — and retrieve it via a URL. A "bucket" is a named container for
those files, like a top-level folder.

### Why does CoreMD use it?
The React frontend compiles down to ~10 static files: `index.html`, a few JS bundles,
CSS files, and font assets. S3 hosts these files. When a user opens the app in their
browser, CloudFront fetches the files from this bucket and delivers them globally.

There is no server involved — S3 just stores the files and CloudFront serves them.
This is called a "static site" and it costs nearly nothing (~$0.023 per GB/month).

### Manual steps

1. Open **AWS Console → S3 → Create bucket**
2. **Bucket name**: choose something unique, e.g. `coremd-frontend-<your-initials>`
3. **AWS Region**: same region as your EC2 (e.g. `eu-central-1`)
4. **Block Public Access**: leave all 4 checkboxes **ON** (bucket stays private — CloudFront will access it via OAC, not public URLs)
5. **Bucket Versioning**: enable (lets you roll back to a previous frontend deploy if something breaks)
6. Leave all other settings as defaults → **Create bucket**

You will upload files to this bucket later using the `deploy_frontend.sh` script or manually via the console.

---

## 2. Origin Access Control (OAC)

### What is it (general)?
OAC is a CloudFront feature that lets CloudFront authenticate itself to S3 using AWS
Signature v4 (SigV4). Without it, CloudFront would need S3 to be publicly readable — a
security hole. With OAC, S3 stays fully private: only requests signed by CloudFront are
accepted.

### Why does CoreMD use it?
The S3 bucket has all public access blocked (step 1 above). OAC is the mechanism that
allows CloudFront to still read the files — it adds a cryptographic signature to every
request it sends to S3, and a bucket policy (see step 5) tells S3 to only allow those
signed requests.

### Manual steps

1. Open **AWS Console → CloudFront → Origin access → Create control setting**
2. **Name**: `coremd-oac`
3. **Origin type**: S3
4. **Signing behavior**: Sign requests (recommended)
5. **Signing protocol**: SigV4
6. → **Create**

Save the OAC ID — you'll need it when creating the CloudFront distribution.

---

## 3. CloudFront Function — SPA Routing

### What is it (general)?
A CloudFront Function is a tiny JavaScript snippet (under 10 KB) that runs at CloudFront
edge locations before a request is forwarded to any origin. It can inspect and rewrite
request URLs, add/remove headers, or block requests. It runs in microseconds and costs
~$0.10 per million invocations.

### Why does CoreMD use it?
CoreMD is a Single Page Application (SPA). There is only one real file: `index.html`.
All other "pages" like `/chapters` or `/dashboard` are rendered client-side by React
Router — they are not actual files in S3.

The problem: if a user bookmarks `https://yourdomain.com/chapters` and opens it
directly, the browser sends a request to CloudFront for `/chapters`. S3 has no file
at that path, so it would return a 403 or 404.

The fix: this CloudFront Function intercepts every request to the S3 origin. If the
URL does not end with a file extension (e.g. `.js`, `.css`, `.png`), it rewrites the
URL to `/index.html`. React then loads and its router renders the correct page.

This function is attached **only** to the default (S3) behavior. The API behavior
(`/api/v1/*`) is intentionally excluded so that real API 404s are not swallowed.

**Function code:**
```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var filename = uri.split('/').pop();
    if (filename && filename.indexOf('.') !== -1) {
        return request;  // has extension → serve file as-is
    }
    request.uri = '/index.html';  // no extension → SPA route, serve index.html
    return request;
}
```

### Manual steps

1. Open **AWS Console → CloudFront → Functions → Create function**
2. **Name**: `coremd-spa-routing`
3. Replace the default code with the function code above
4. **Save changes**
5. Switch to the **Publish** tab → click **Publish function**

Save the function ARN — you'll need it when configuring the CloudFront distribution.

---

## 4. CloudFront Distribution

### What is it (general)?
CloudFront is AWS's CDN (Content Delivery Network). It has ~450 "edge locations"
worldwide. When a user requests a file, CloudFront serves it from the edge nearest
to them instead of making them connect to your origin server (S3 or EC2) every time.

Beyond caching, CloudFront can also act as a **reverse proxy** — routing different
URL paths to different backend servers based on path patterns. This is the key feature
CoreMD uses.

### Why does CoreMD use it?
CoreMD has two backends:
- **S3**: serves the React frontend (static files)
- **EC2**: serves the FastAPI backend (dynamic API)

Both are exposed through a single CloudFront domain, so the browser sees one URL.
CloudFront routes based on path:

| Path pattern | Goes to | What it does |
|---|---|---|
| `/api/v1/*` | EC2 `:8000` | FastAPI API calls |
| `/static/*` | EC2 `:8000` | Medical textbook images served by FastAPI |
| `*` (everything else) | S3 bucket | React SPA static files |

This also provides HTTPS for free: users connect to CloudFront over HTTPS, and
CloudFront connects to EC2 over plain HTTP internally. EC2 never needs an SSL certificate.

### Manual steps

1. Open **AWS Console → CloudFront → Distributions → Create distribution**

**Origins** — add two origins:

**Origin 1 — S3:**
- Origin domain: select your S3 bucket from the dropdown
- Name: `S3Origin`
- Origin access: **Origin access control settings (recommended)**
- Select the OAC you created in step 2
- Click **Create new OAC** if not already listed

**Origin 2 — EC2:**
- Origin domain: paste your EC2 public DNS hostname (e.g. `ec2-1-2-3-4.eu-central-1.compute.amazonaws.com`)
- Name: `EC2Origin`
- Protocol: HTTP only
- HTTP port: 8000

**Default cache behavior** (S3 — the fallback):
- Origin: S3Origin
- Viewer protocol policy: Redirect HTTP to HTTPS
- Allowed HTTP methods: GET, HEAD
- Cache policy: `CachingOptimized` (ID: `658327ea-...`)
- Function associations → Viewer request → select `coremd-spa-routing`

**Cache behaviors** — add two (CloudFront evaluates these before the default):

**Behavior 1 — API:**
- Path pattern: `/api/v1/*`
- Origin: EC2Origin
- Viewer protocol policy: HTTPS only
- Allowed HTTP methods: GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE
- Cache policy: `CachingDisabled` (ID: `4135ea2d-...`)
- Origin request policy: `AllViewer` (ID: `b689b0a8-...`) — forwards all headers, query strings, and cookies to EC2

**Behavior 2 — Static images:**
- Path pattern: `/static/*`
- Origin: EC2Origin
- Viewer protocol policy: HTTPS only
- Allowed HTTP methods: GET, HEAD
- Cache policy: `CachingOptimized`

**Distribution settings:**
- Price class: Use only North America and Europe (cheapest)
- Default root object: `index.html`
- → **Create distribution**

Wait 5–15 minutes for the distribution to deploy (status changes from "In Progress" to "Enabled").

---

## 5. S3 Bucket Policy

### What is it (general)?
A bucket policy is a JSON document attached to an S3 bucket that defines who is allowed
to perform which actions on the bucket. It's the S3 equivalent of file permissions on
a Linux filesystem.

### Why does CoreMD use it?
Because the bucket is fully private (no public access), it rejects all requests by
default. The bucket policy adds one exception: allow CloudFront (identified by OAC
signature + the specific distribution ARN) to call `s3:GetObject` on any object in
the bucket.

Without this policy, CloudFront would get a 403 from S3 on every request.

### Manual steps

1. Open **AWS Console → S3 → your bucket → Permissions tab → Bucket policy → Edit**
2. Paste the following JSON, replacing the placeholders:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
        }
      }
    }
  ]
}
```

- `YOUR-BUCKET-NAME`: the S3 bucket name from step 1
- `YOUR-ACCOUNT-ID`: your 12-digit AWS account ID (visible in the top-right corner of the console)
- `YOUR-DISTRIBUTION-ID`: the CloudFront distribution ID from step 4 (e.g. `E1N2RCA07V92OO`)

3. → **Save changes**

---

## 6. EC2 Key Pair

### What is it (general)?
EC2 uses SSH key pairs for authentication instead of passwords. The key pair is an
asymmetric cryptographic pair: AWS keeps the public key on your EC2 instance, and you
keep the private key file (`.pem`) on your local machine. `ssh` uses the private key
to prove your identity when connecting.

### Why does CoreMD use it?
You need to SSH into the EC2 instance to:
- Clone the repo for the first time
- Create the `.env.production` file with secrets
- Run `docker compose up` to start the backend
- Pull new code after a git push

### Manual steps

1. Open **AWS Console → EC2 → Key Pairs → Create key pair**
2. **Name**: `coremd-key`
3. **Key pair type**: RSA
4. **Private key file format**: `.pem` (for Linux/Mac/WSL) or `.ppk` (for PuTTY on Windows)
5. → **Create key pair** — the `.pem` file downloads automatically
6. Move it to `~/.ssh/coremd-key.pem`
7. Set permissions (Linux/Mac/WSL):
   ```bash
   chmod 400 ~/.ssh/coremd-key.pem
   ```

**Important**: You cannot download the private key again after creation. If you lose it,
you must create a new key pair and recreate the EC2 instance.

---

## 7. EC2 Security Group

### What is it (general)?
A Security Group is a virtual firewall for EC2 instances. It has inbound rules (what
traffic is allowed IN to the instance) and outbound rules (what traffic the instance
can send OUT). Rules are defined by protocol, port range, and IP source/destination.

By default, all inbound traffic is blocked and all outbound traffic is allowed.

### Why does CoreMD use it?
The FastAPI backend needs to be reachable on two ports:
- **Port 22** (SSH): so you can connect to the instance to deploy updates
- **Port 8000** (API): so CloudFront can forward API requests to FastAPI

Without these rules, CloudFront's requests to port 8000 would be silently dropped.

> **Security note:** The current config allows port 22 from `0.0.0.0/0` (any IP).
> For a production system, restrict SSH to your own IP only.
> For this personal learning project, leaving it open is acceptable.

### Manual steps

1. Open **AWS Console → EC2 → Security Groups → Create security group**
2. **Security group name**: `coremd-backend-sg`
3. **Description**: CoreMD backend - allow SSH and API
4. **VPC**: leave as default

**Inbound rules** — add two:

| Type | Protocol | Port | Source | Why |
|---|---|---|---|---|
| SSH | TCP | 22 | 0.0.0.0/0 | SSH access from your machine |
| Custom TCP | TCP | 8000 | 0.0.0.0/0 | FastAPI API (CloudFront → EC2) |

5. Leave outbound rules as default (allow all)
6. → **Create security group**

---

## 8. EC2 Instance

### What is it (general)?
EC2 (Elastic Compute Cloud) is AWS's virtual machine service. An EC2 instance is a
Linux (or Windows) server running in AWS's data center. You choose the hardware spec
(instance type), the operating system (AMI), storage, and networking.

The `t3.micro` instance type (1 vCPU, 1 GB RAM) is in the AWS Free Tier for the first
12 months of a new account. After that it costs ~$8/month.

### Why does CoreMD use it?
The FastAPI backend is a long-running Python process that can't run on a static host.
It needs a real server to:
- Respond to HTTP requests from CloudFront
- Connect to MongoDB Atlas
- Connect to Redis (also running on the same instance as a Docker container)
- Serve static images from disk (`/static/images/*.jpg`)

Docker and docker-compose run on this instance to manage the FastAPI + Redis containers.

### Manual steps

1. Open **AWS Console → EC2 → Instances → Launch instances**

**Name**: `coremd-backend`

**AMI** (operating system): Search for **Amazon Linux 2023** → select the latest x86_64 AMI

**Instance type**: `t3.micro` (Free Tier eligible)

**Key pair**: select `coremd-key` (created in step 6)

**Network settings**:
- VPC: default
- Subnet: any (pick one in the same region)
- Auto-assign public IP: Enable
- Firewall (security groups): select existing → choose `coremd-backend-sg` (step 7)

**Configure storage**: 20 GB gp3 (default 8 GB is too small for Docker images + medical images)

**Advanced details → User data**: paste the following shell script.
This runs automatically on first boot and installs Docker, docker-compose, and git:

```bash
#!/bin/bash
yum update -y
yum install -y git docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user
mkdir -p /usr/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/lib/docker/cli-plugins/docker-compose
chmod +x /usr/lib/docker/cli-plugins/docker-compose
```

2. → **Launch instance**

Wait ~2 minutes for the instance to reach "running" state and for the UserData script to finish.

**Connect to the instance:**
```bash
ssh -i ~/.ssh/coremd-key.pem ec2-user@<public-ip>
```

Once connected, clone the repo and create `.env.production`:
```bash
git clone https://github.com/your-username/CoreMD.git
cd CoreMD
nano infra/env/.env.production   # fill in MONGO_URI, JWT_SECRET, OPENAI_API_KEY
```

Start the backend:
```bash
docker compose -f infra/docker-compose.prod.yml up -d --build
```

Verify it's running:
```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

---

## 9. Elastic IP

### What is it (general)?
By default, an EC2 instance gets a new public IP every time it reboots. An Elastic IP
is a static public IP address you allocate from AWS and permanently attach to an
instance. The IP never changes, even across reboots or instance replacements.

Elastic IPs are free while attached to a running instance. If you stop the instance
but keep the EIP allocated, AWS charges ~$0.005/hour as a penalty for "wasting" a
scarce resource.

### Why does CoreMD use it?
CloudFront's EC2 origin is configured with the EC2 hostname/IP. If the instance
reboots and the IP changes:
- The CloudFront distribution would stop working (pointing at the old IP)
- You'd have to update the CloudFormation stack and wait for CloudFront to redeploy

An Elastic IP eliminates this problem. The IP stays the same forever, so CloudFront
always knows where to find EC2.

### Manual steps

1. Open **AWS Console → EC2 → Elastic IPs → Allocate Elastic IP address**
2. Network border group: leave as default (your region)
3. → **Allocate**
4. Select the newly allocated IP → **Actions → Associate Elastic IP address**
5. **Resource type**: Instance
6. **Instance**: select `coremd-backend`
7. → **Associate**

The EC2 instance now has a permanent public IP. Use this IP:
- In the CloudFront distribution's EC2 origin domain (or the DNS hostname — same thing)
- In `deploy_frontend.sh` as `VITE_API_URL` host
- In `deploy_backend.sh` as the SSH target

---

## Summary — What Each Component Does in CoreMD

```
User's Browser
      │
      │  HTTPS
      ▼
CloudFront Distribution          ← single entry point for the whole app
      │
      ├── /api/v1/*  ──────────► EC2 :8000  (FastAPI — auth, chapters, questions, AI)
      │                               │
      ├── /static/*  ──────────►      │       (medical textbook images, served by FastAPI)
      │                               │
      └── everything else ─────► S3 Bucket  (React SPA: index.html + JS/CSS bundles)
                │
                └── CloudFront Function rewrites unknown paths → /index.html
                    so React Router handles /chapters, /dashboard, etc.

Security:
  S3 Bucket: private, only CloudFront (via OAC + bucket policy) can read it
  EC2: Security Group allows port 22 (SSH) and 8000 (API) only
  CloudFront: HTTPS to browser, HTTP to EC2 internally
  Elastic IP: EC2 keeps the same IP across reboots so CloudFront's origin never breaks
```

---

## Automation vs. Manual

Everything above is what `aws cloudformation deploy` does automatically when you run:

```bash
aws cloudformation deploy \
  --template-file infra/cloudformation/01-frontend.yml \
  --stack-name coremd-frontend \
  --parameter-overrides BackendHostname=<ec2-hostname>

aws cloudformation deploy \
  --template-file infra/cloudformation/02-ec2.yml \
  --stack-name coremd-ec2 \
  --parameter-overrides KeyName=coremd-key \
  --capabilities CAPABILITY_IAM
```

The CloudFormation templates are just a machine-readable description of everything in
this guide. If you ever want to tear everything down and start fresh, CloudFormation
can delete all resources in one command:

```bash
aws cloudformation delete-stack --stack-name coremd-frontend
aws cloudformation delete-stack --stack-name coremd-ec2
```
