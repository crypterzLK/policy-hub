# Reliable Folder-Based Policy Delivery

This document describes the reliable, folder-based delivery system for Policy Hub releases.

## Overview

The reliable delivery system ensures **exactly-once delivery semantics** for policy folders by:

- **Tracking delivery state** per folder using commit SHAs
- **Automatic retry** of failed deliveries on subsequent releases
- **Idempotent operations** to prevent duplicate processing
- **Granular failure handling** (folder-level vs release-level)

## Architecture

```
GitHub Release Published
        ↓
    Detect Changes
        ↓
  Check Delivery Status
        ↓
   Deliver Pending Folders
        ↓
   Update State (Success Only)
        ↓
   Update Baseline
```

## State Management

### `.state/baseline.sha`
- Contains the earliest commit SHA to consider for changes
- Initially set to repository root commit
- Updated after each successful release

### `.state/delivered.json`
```json
{
  "_metadata": {
    "version": "1.0.0",
    "description": "Tracks successful policy deliveries",
    "lastUpdated": "2025-12-15T10:30:00Z"
  },
  "deliveries": {
    "policies/set-header/v1.0.0": {
      "commitSha": "abc123...",
      "deliveredAt": "2025-12-15T10:30:00Z",
      "status": "delivered"
    }
  }
}
```

## Workflow Jobs

### 1. Setup Delivery
- Configures environment and tools
- Extracts baseline and head SHAs
- Prepares for delivery operations

### 2. Detect Changes
- Identifies folders changed since baseline
- Uses `git diff` to find modified policy folders
- Outputs JSON array of changed folders

### 3. Check Delivery Status
- Determines which changed folders need delivery
- Compares latest commit SHAs with delivered state
- Skips already-delivered folders

### 4. Deliver Policies
- **Matrix strategy** for parallel folder processing
- **Fail-fast: false** - continues with other folders on failure
- Each folder goes through: validation → packaging → upload → sync

### 5. Update Baseline
- Advances baseline SHA to current head
- Commits state changes back to repository
- Ensures future releases only process new changes

### 6. Delivery Summary
- Provides comprehensive delivery report
- Shows success/failure statistics
- Links to release for traceability

## Actions

### Detect Changes Action
- **Input**: baseline-sha, head-sha
- **Output**: changed-folders JSON array, folder-count
- **Logic**: `git diff --name-only` filtered to policy folders

### Check Delivery Status Action
- **Input**: changed-folders, baseline-sha
- **Output**: pending-folders, skipped-folders, pending-count
- **Logic**: Compare commit SHAs with delivery state

### Deliver Policy Action
- **Input**: folder-path, S3 config, API config
- **Output**: success, commit-sha
- **Steps**: validate → package → upload → sync → cleanup

### Update State Action
- **Input**: folder-path, commit-sha, timestamp
- **Logic**: Updates delivered.json with successful delivery

## Error Handling

### Folder-Level Failures
- Individual folder failures don't stop other deliveries
- Failed folders automatically retry on next release
- State only updated on successful delivery

### Release-Level Failures
- Workflow failures are logged but don't block repository
- State updates are committed atomically
- Baseline advancement happens regardless of individual failures

## Idempotency

### Commit SHA Tracking
- Each folder delivery is tied to a specific commit SHA
- Re-delivery of same SHA is skipped automatically
- Ensures exactly-once delivery semantics

### Idempotency Keys
- API calls include `folder:commit_sha` as idempotency key
- Prevents duplicate processing at Policy Hub level
- Safe to retry failed operations

## Benefits

✅ **Reliability**: Failed deliveries retry automatically
✅ **Efficiency**: Only processes changed folders
✅ **Safety**: Idempotent operations prevent duplicates
✅ **Observability**: Complete audit trail in Git history
✅ **Scalability**: Parallel processing with controlled concurrency
✅ **Maintainability**: Clear separation of concerns

## Usage

1. **Create policies** in `policies/{name}/{version}/` folders
2. **Commit and push** changes to main branch
3. **Create GitHub release** to trigger delivery
4. **Monitor workflow** for delivery status
5. **Failed deliveries** retry automatically on next release

## Configuration

### Required Variables
- `S3_BUCKET_NAME`: S3 bucket for policy artifacts
- `POLICY_HUB_API_URL`: Policy Hub API endpoint
- `AWS_REGION`: AWS region for S3

### Required Secrets
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `POLICY_HUB_API_KEY`: Policy Hub API authentication

## Monitoring

### Success Indicators
- Workflow completes with "success" status
- All pending folders show successful delivery
- State file updated with new deliveries

### Failure Indicators
- Workflow shows "failure" status
- Some folders remain in pending state
- Check delivery summary for specific failures

### Logs
- Each action provides detailed logging
- API responses are captured and logged
- State changes are traceable in Git history