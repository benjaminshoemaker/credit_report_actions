#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <build-dir> <s3-bucket>" >&2
  exit 1
fi

BUILD_DIR="$1"
S3_BUCKET="$2"
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"

aws --profile "$AWS_PROFILE" --region "$AWS_REGION" s3 sync "$BUILD_DIR" "s3://$S3_BUCKET" --delete
