#!/usr/bin/env bash
# Usage: bash infra/scripts/deploy_frontend.sh <BUCKET_NAME> <DIST_ID> <EC2_IP>
# Example: bash infra/scripts/deploy_frontend.sh my-bucket-abc123 E1ABC123XYZ 54.12.34.56
set -euo pipefail

BUCKET_NAME="${1:?Usage: $0 <BUCKET_NAME> <DIST_ID> <EC2_IP>}"
DIST_ID="${2:?Usage: $0 <BUCKET_NAME> <DIST_ID> <EC2_IP>}"
EC2_IP="${3:?Usage: $0 <BUCKET_NAME> <DIST_ID> <EC2_IP>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Building React app with VITE_API_URL=http://$EC2_IP:8000/api/v1 ..."
cd "$REPO_ROOT/frontend"
VITE_API_URL="http://$EC2_IP:8000/api/v1" npm run build

echo "Uploading to S3 bucket $BUCKET_NAME ..."
aws s3 sync dist/ "s3://$BUCKET_NAME" --delete

echo "Invalidating CloudFront cache $DIST_ID ..."
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"

echo "Done. App available at your CloudFront domain."
