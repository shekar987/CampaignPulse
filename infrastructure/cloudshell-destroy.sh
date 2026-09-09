#!/usr/bin/env bash
# Removes everything cloudshell-deploy.sh created for a stage: functions first, then the platform
# (including the database, without a final snapshot). Run from the repository root.
set -euo pipefail

STAGE="${STAGE:-dev}"
export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-2}}"
export AWS_DEFAULT_REGION="$AWS_REGION"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PATH="$HOME/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" && nvm use 24 >/dev/null 2>&1 || true

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
STATE_BUCKET="campaignpulse-terraform-state-${ACCOUNT_ID}"

read -r -p "Tear down stage '$STAGE' in account $ACCOUNT_ID ($AWS_REGION)? Type the stage name to confirm: " CONFIRM
[ "$CONFIRM" = "$STAGE" ] || { echo "aborted"; exit 1; }

pushd infrastructure/serverless >/dev/null
npx -y serverless@4 remove --stage "$STAGE" --region "$AWS_REGION" || true
popd >/dev/null

pushd infrastructure/terraform >/dev/null
export TF_VAR_stage="$STAGE" TF_VAR_region="$AWS_REGION" TF_VAR_database_url="placeholder"
terraform init -input=false \
  -backend-config="bucket=$STATE_BUCKET" \
  -backend-config="key=campaignpulse/${STAGE}.tfstate" \
  -backend-config="region=$AWS_REGION" >/dev/null
terraform destroy -input=false -auto-approve
popd >/dev/null

echo "Stage '$STAGE' removed. The state bucket $STATE_BUCKET is kept; delete it in S3 if no longer needed."
