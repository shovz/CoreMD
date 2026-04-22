#!/usr/bin/env bash
# Usage: bash infra/scripts/deploy_backend.sh <EC2_IP> <KEY_FILE>
# Example: bash infra/scripts/deploy_backend.sh 54.12.34.56 ~/.ssh/coremd-key.pem
set -euo pipefail

EC2_IP="${1:?Usage: $0 <EC2_IP> <KEY_FILE>}"
KEY_FILE="${2:?Usage: $0 <EC2_IP> <KEY_FILE>}"

SSH="ssh -i $KEY_FILE -o StrictHostKeyChecking=no ec2-user@$EC2_IP"

echo "Deploying backend to $EC2_IP ..."
$SSH '
  set -e
  cd ~/CoreMD
  git pull
  docker compose -f infra/docker-compose.prod.yml up -d --build
  docker compose -f infra/docker-compose.prod.yml ps
'

echo "Done. API available at http://$EC2_IP:8000/health"
