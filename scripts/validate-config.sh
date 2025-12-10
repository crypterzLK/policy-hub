#!/bin/bash

# Validate configuration file
# Usage: ./validate-config.sh

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$REPO_ROOT/config/policy-hub-config.json"

echo "🔍 Validating configuration file..."

# Check if config file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "❌ Configuration file not found: $CONFIG_FILE"
  exit 1
fi

# Validate JSON syntax
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
  echo "❌ Invalid JSON syntax in configuration file"
  exit 1
fi

# Validate required fields
required_fields=(
  ".s3.path"
  ".policyHub.timeout"
  ".validation.requiredFiles"
  ".validation.requiredDirs"
  ".validation.versionRegex"
  ".processing.maxParallelJobs"
)

for field in "${required_fields[@]}"; do
  if ! jq -e "$field" "$CONFIG_FILE" >/dev/null 2>&1; then
    echo "❌ Missing required configuration field: $field"
    exit 1
  fi
done

# Validate specific values
max_jobs=$(jq -r '.processing.maxParallelJobs' "$CONFIG_FILE")
if [[ ! "$max_jobs" =~ ^[1-9][0-9]*$ ]] || [[ "$max_jobs" -gt 10 ]]; then
  echo "❌ maxParallelJobs must be between 1 and 10"
  exit 1
fi

timeout=$(jq -r '.policyHub.timeout' "$CONFIG_FILE")
if [[ ! "$timeout" =~ ^[1-9][0-9]*$ ]] || [[ "$timeout" -gt 300 ]]; then
  echo "❌ timeout must be between 1 and 300 seconds"
  exit 1
fi

echo "✅ Configuration file is valid"