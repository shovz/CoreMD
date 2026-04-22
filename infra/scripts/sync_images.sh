#!/usr/bin/env bash
# Usage: bash infra/scripts/sync_images.sh <EC2_IP> <KEY_FILE>
# Example: bash infra/scripts/sync_images.sh 54.12.34.56 ~/.ssh/coremd-key.pem
# Rsyncs backend/static/images/ to EC2 - only transfers new/changed files.
set -euo pipefail

EC2_IP="${1:?Usage: $0 <EC2_IP> <KEY_FILE>}"
KEY_FILE="${2:?Usage: $0 <EC2_IP> <KEY_FILE>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGES_DIR="$SCRIPT_DIR/../../backend/static/images/"

echo "Syncing images to ec2-user@$EC2_IP:~/CoreMD/backend/static/images/ ..."
rsync -avz --progress \
  -e "ssh -i $KEY_FILE -o StrictHostKeyChecking=no" \
  "$IMAGES_DIR" \
  "ec2-user@$EC2_IP:~/CoreMD/backend/static/images/"

echo "Done."
