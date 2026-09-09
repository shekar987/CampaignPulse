#!/usr/bin/env bash
# Deploys CampaignPulse from AWS CloudShell using the console session's own permissions, so no
# access key is ever created. Run from the repository root:
#
#   bash infrastructure/cloudshell-deploy.sh
#
# Optional environment: STAGE (default dev), AWS_REGION (default eu-west-2), ALERT_EMAIL,
# SERVERLESS_ACCESS_KEY (or run `npx serverless login` first), CREATE_DATABASE (default true),
# DATABASE_URL (only when CREATE_DATABASE=false).
set -euo pipefail

STAGE="${STAGE:-dev}"
export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-eu-west-2}}"
export AWS_DEFAULT_REGION="$AWS_REGION"
CREATE_DATABASE="${CREATE_DATABASE:-true}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------------------------
# Tooling: Node.js 22+ (via nvm) and Terraform (portable binary in ~/bin).
# ---------------------------------------------------------------------------------------------
node_major() { node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0; }
if [ "$(node_major)" -lt 22 ]; then
  log "Installing Node.js 24 with nvm"
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash >/dev/null
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 24 >/dev/null
  nvm use 24 >/dev/null
fi
log "Node $(node --version), npm $(npm --version)"

if ! command -v terraform >/dev/null 2>&1; then
  log "Installing Terraform"
  mkdir -p "$HOME/bin"
  TF_VERSION="$(curl -fsSL https://checkpoint-api.hashicorp.com/v1/check/terraform | sed -E 's/.*"current_version":"([^"]+)".*/\1/')"
  curl -fsSL "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_linux_amd64.zip" -o /tmp/terraform.zip
  unzip -oq /tmp/terraform.zip -d "$HOME/bin"
  export PATH="$HOME/bin:$PATH"
fi
log "Terraform $(terraform version -json | sed -E 's/.*"terraform_version":"([^"]+)".*/\1/')"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
log "Deploying stage '$STAGE' to account $ACCOUNT_ID in $AWS_REGION"

# ---------------------------------------------------------------------------------------------
# Terraform state bucket (the same one the bootstrap stack would create).
# ---------------------------------------------------------------------------------------------
STATE_BUCKET="campaignpulse-terraform-state-${ACCOUNT_ID}"
if ! aws s3api head-bucket --bucket "$STATE_BUCKET" >/dev/null 2>&1; then
  log "Creating Terraform state bucket $STATE_BUCKET"
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$STATE_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$STATE_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
  aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" --versioning-configuration Status=Enabled
  aws s3api put-public-access-block --bucket "$STATE_BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

# ---------------------------------------------------------------------------------------------
# Platform.
# ---------------------------------------------------------------------------------------------
log "Provisioning the platform with Terraform"
pushd infrastructure/terraform >/dev/null
export TF_VAR_stage="$STAGE" TF_VAR_region="$AWS_REGION" TF_VAR_create_database="$CREATE_DATABASE"
export TF_VAR_database_url="${DATABASE_URL:-}" TF_VAR_alert_email="${ALERT_EMAIL:-}"
terraform init -input=false \
  -backend-config="bucket=$STATE_BUCKET" \
  -backend-config="key=campaignpulse/${STAGE}.tfstate" \
  -backend-config="region=$AWS_REGION" >/dev/null
terraform apply -input=false -auto-approve
SECRET_ARN="$(terraform output -raw database_secret_arn)"
WEB_BUCKET="$(terraform output -raw web_bucket)"
WEB_DISTRIBUTION_ID="$(terraform output -raw web_distribution_id)"
WEB_URL="$(terraform output -raw web_url)"
popd >/dev/null

DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text)"
export DATABASE_URL

# ---------------------------------------------------------------------------------------------
# Application build, database schema and demo data.
# ---------------------------------------------------------------------------------------------
log "Installing dependencies"
npm ci --no-audit --no-fund
log "Generating Prisma client and GraphQL types"
npm run codegen
log "Applying database migrations"
(cd apps/api && npx prisma migrate deploy)
log "Seeding demo data if the database is empty"
COUNT="$(cd apps/api && node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => c.query('select count(*)::int as n from campaigns'))
    .then(r => { console.log(r.rows[0].n); return c.end(); });
")"
if [ "$COUNT" = "0" ]; then (cd apps/api && npx prisma db seed); else echo "database already has $COUNT campaigns"; fi

log "Bundling Lambda handlers"
npm run build:lambda

# ---------------------------------------------------------------------------------------------
# Functions.
# ---------------------------------------------------------------------------------------------
log "Deploying functions with the Serverless Framework"
pushd infrastructure/serverless >/dev/null
npx -y serverless@4 deploy --stage "$STAGE" --region "$AWS_REGION"
popd >/dev/null
API_URL="$(aws apigatewayv2 get-apis --query "Items[?Name=='${STAGE}-campaignpulse'].ApiEndpoint | [0]" --output text)"

# ---------------------------------------------------------------------------------------------
# Web app.
# ---------------------------------------------------------------------------------------------
log "Building and publishing the web app"
VITE_GRAPHQL_URL="${API_URL}/graphql" npm run build -w apps/web
aws s3 sync apps/web/dist "s3://${WEB_BUCKET}" --delete
aws cloudfront create-invalidation --distribution-id "$WEB_DISTRIBUTION_ID" --paths "/*" >/dev/null

log "Smoke test"
curl -sS -X POST "${API_URL}/graphql" -H 'content-type: application/json' \
  -d '{"query":"{ status { name version environment } systemHealth { openIncidents deadLetterCount } }"}'
echo

cat <<EOF

CampaignPulse ${STAGE} is deployed.

  Web app:              ${WEB_URL}
  GraphQL API:          ${API_URL}/graphql
  CloudWatch dashboard: https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=campaignpulse-${STAGE}

CloudFront can take a few minutes to serve the first deployment.
Tear down later with: bash infrastructure/cloudshell-destroy.sh
EOF
