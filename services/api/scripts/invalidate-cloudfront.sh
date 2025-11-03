#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <distribution-id> [path1 path2 ...]" >&2
  exit 1
fi

DISTRIBUTION_ID="$1"
shift
PATHS=(${*:-'/*'})
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"

aws --profile "$AWS_PROFILE" --region "$AWS_REGION" cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "${PATHS[@]}"
