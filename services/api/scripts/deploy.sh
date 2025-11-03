#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="aprcut-api"
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"

sam build --profile "$AWS_PROFILE" --region "$AWS_REGION"
sam deploy \
  --stack-name "$STACK_NAME" \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --confirm-changeset
