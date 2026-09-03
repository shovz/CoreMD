#!/usr/bin/env bash
# Usage: bash infra/scripts/deploy_frontend.sh <BUCKET_NAME> <DIST_ID>
# Example: bash infra/scripts/deploy_frontend.sh my-bucket-abc123 E1ABC123XYZ
# API calls go to /api/v1 (relative) — CloudFront proxies them to EC2 backend.
set -euo pipefail

BUCKET_NAME="${1:?Usage: $0 <BUCKET_NAME> <DIST_ID>}"
DIST_ID="${2:?Usage: $0 <BUCKET_NAME> <DIST_ID>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building React app with VITE_API_URL=/api/v1 (same-origin via CloudFront) ..."
cd "$REPO_ROOT/frontend"
# MSYS_NO_PATHCONV=1 prevents Git Bash on Windows from converting /api/v1 to C:/Program Files/Git/api/v1
MSYS_NO_PATHCONV=1 VITE_API_URL="/api/v1" npm run build

echo "Uploading to S3 bucket $BUCKET_NAME ..."
aws s3 sync dist/ "s3://$BUCKET_NAME" --delete

echo "Invalidating CloudFront cache $DIST_ID ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Done. App available at your CloudFront domain."
