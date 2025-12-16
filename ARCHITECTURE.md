# Policy Hub - Reliable Folder-Based Delivery System

## 🎯 Overview

This repository implements a **reliable, idempotent, and failure-safe policy delivery system** triggered by GitHub Releases. The system ensures that policies are delivered exactly once, with automatic retry for failures, and granular per-folder tracking.

## 🏗️ Architecture

### Core Principles

1. **Release-driven**: Execution happens only on GitHub Release events
2. **Incremental**: Only data changed since the last successful delivery is considered
3. **Granular reliability**: Delivery is tracked **per folder**, not per release
4. **Failure-safe**: Failed API calls are automatically retried on the next release
5. **Idempotent**: Repeated attempts do not cause duplicate side effects

### System Components

```
.state/                          # State management directory
├── baseline.sha                 # Baseline commit for change detection
└── delivered.json               # Per-folder delivery tracking

.github/
├── actions/                     # JavaScript-based custom actions
│   ├── detect-changed-policies/ # Detects changed policy folders
│   ├── validate-policy/         # Validates policy structure
│   ├── check-delivery-status/   # Checks if already delivered
│   ├── publish-policy/          # Publishes to Policy Hub API
│   └── update-delivery-state/   # Updates delivery state
└── workflows/
    └── batch-release.yml        # Main release workflow
```

## 📊 State Management

### baseline.sha

Stores the **earliest commit SHA** from which changes must be considered.

- **First release**: defaults to repository root commit
- **Subsequent releases**: used to compute change delta

Example:
```
acde1234567890
```

### delivered.json

Tracks successful delivery **per policy folder**.

Example:
```json
{
  "policies/rate-limiter/v1.0.0": {
    "sha": "acde123",
    "deliveredAt": "2025-12-16T10:30:00Z",
    "release": "v1.2.0"
  },
  "policies/quota/v2.1.0": {
    "sha": "bb912fa",
    "deliveredAt": "2025-12-16T10:31:00Z",
    "release": "v1.2.0"
  }
}
```

## 🔄 Workflow Execution Flow

### 1. Initialize Baseline & State

- Reads or creates `baseline.sha`
- Verifies baseline SHA exists in repository
- Sets up state tracking

### 2. Detect Changed Policies

```javascript
// Compares baseline SHA to HEAD
git diff --name-only baseline.sha..HEAD

// Extracts policy folders (policies/<name>/v<version>)
// Returns: [{path, name, version, sha}, ...]
```

### 3. Validate & Check Delivery Status (Parallel)

For each detected policy:

**Validation:**
- Checks required files: `metadata.json`, `policy-definition.yaml`
- Checks required directories: `docs/`, `src/`
- Validates metadata fields and format
- Validates documentation completeness

**Delivery Status:**
- Reads `delivered.json`
- Compares current SHA with delivered SHA
- Decides: `never-delivered`, `sha-changed`, or `already-delivered`

### 4. Publish Policies (Parallel)

For each policy that needs delivery:

**Publishing:**
- Prepares payload with metadata and definition
- Sends to Policy Hub API with idempotency key (commit SHA)
- Handles response codes (200-299: success, 409: already exists)

**State Update:**
- Updates `delivered.json` with new SHA
- Records delivery timestamp and release tag

### 5. Finalize State

- Merges all delivery states from parallel jobs
- Commits updated `delivered.json` to repository
- Preserves state for next release

## 🎯 Partial Failure Handling

### Scenario: Release v1.2.0

Detected folders: `A`, `B`, `C`

| Folder | API Result | State Updated |
|--------|------------|---------------|
| A      | ✅ Success | Yes           |
| B      | ❌ Failure | No            |
| C      | ✅ Success | Yes           |

### Scenario: Release v1.3.0

Workflow behavior:

- **A** → ⏭️ Skipped (already delivered)
- **B** → 🔄 Retried (not in delivered.json)
- **C** → ⏭️ Skipped (already delivered)
- **New folders** → ✅ Processed normally

## 🚀 Actions Reference

### 1. detect-changed-policies

**Purpose**: Detects policy folders that changed since baseline

**Inputs:**
- `baseline-sha`: Baseline commit SHA
- `workspace`: Workspace path

**Outputs:**
- `changed-policies`: JSON array of policies
- `changed-policies-matrix`: Matrix-formatted JSON
- `policy-count`: Number of changed policies

**Algorithm:**
```javascript
1. Get all changed files: git diff baseline..HEAD
2. Filter policy paths: policies/<name>/v<version>/...
3. Extract unique policy folders
4. Get latest commit SHA for each folder
5. Return enriched policy data
```

### 2. validate-policy

**Purpose**: Validates policy structure and metadata

**Inputs:**
- `policy-path`: Policy folder path
- `config-file`: Configuration file path

**Outputs:**
- `valid`: Whether policy is valid
- `validation-errors`: Array of errors
- `validation-warnings`: Array of warnings

**Validations:**
- ✅ Required files present
- ✅ Required directories exist
- ✅ Metadata fields complete
- ✅ Version format correct
- ✅ Documentation files present

### 3. check-delivery-status

**Purpose**: Determines if policy needs delivery

**Inputs:**
- `policy-path`: Policy folder path
- `policy-sha`: Current commit SHA
- `state-file`: Path to delivered.json

**Outputs:**
- `should-deliver`: true/false
- `delivery-reason`: Reason for decision
- `last-delivered-sha`: Previous SHA if any

**Decision Logic:**
```javascript
if (policy not in delivered.json) {
  return { shouldDeliver: true, reason: 'never-delivered' }
}

if (policy.sha !== delivered.sha) {
  return { shouldDeliver: true, reason: 'sha-changed' }
}

return { shouldDeliver: false, reason: 'already-delivered' }
```

### 4. publish-policy

**Purpose**: Publishes policy to Policy Hub API

**Inputs:**
- `policy-path`, `policy-name`, `policy-version`, `policy-sha`
- `api-url`: Policy Hub API URL
- `api-key`: Authentication key
- `timeout`: Request timeout (default: 30s)

**Outputs:**
- `published`: Success/failure
- `api-response`: Response message
- `policy-url`: Published policy URL

**Features:**
- 🔐 Idempotency via `X-Idempotency-Key` header (commit SHA)
- ⏱️ Configurable timeout
- 🔄 Handles 409 (already exists) as success
- 📊 Detailed error reporting

### 5. update-delivery-state

**Purpose**: Updates state after successful delivery

**Inputs:**
- `policy-path`: Policy folder path
- `policy-sha`: Delivered commit SHA
- `release-tag`: GitHub release tag
- `state-file`: Path to delivered.json

**Outputs:**
- `state-updated`: Success indicator
- `previous-sha`: Previous SHA if existed

**State Format:**
```json
{
  "policies/rate-limiter/v1.0.0": {
    "sha": "abc123",
    "deliveredAt": "2025-12-16T10:30:00Z",
    "release": "v1.2.0"
  }
}
```

## 📝 Configuration

### Environment Variables

```yaml
env:
  POLICY_HUB_API_URL: ${{ vars.POLICY_HUB_API_URL }}
  AWS_REGION: ${{ vars.AWS_REGION }}
  MAX_PARALLEL: ${{ vars.MAX_PARALLEL || 3 }}
```

### Secrets Required

- `POLICY_HUB_API_KEY`: API key for Policy Hub authentication
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Repository Variables

- `POLICY_HUB_API_URL`: Base URL for Policy Hub API
- `MAX_PARALLEL`: Maximum parallel jobs (default: 3)
- `AWS_REGION`: AWS region for deployments

## 🎨 Workflow Features

### Parallel Processing

- ⚡ Validates multiple policies in parallel
- ⚡ Publishes multiple policies in parallel
- ⚙️ Configurable max-parallel limit
- 🛡️ fail-fast: false (one failure doesn't stop others)

### Error Handling

- ✅ Validation failures prevent publishing
- ✅ Publishing failures are logged and retried next release
- ✅ State is only updated on successful delivery
- ✅ Partial failures don't corrupt state

### Observability

- 📊 GitHub Actions summaries for each step
- 📈 Detailed logs with emojis for easy scanning
- 🎯 Per-policy status tracking
- 📋 Release summary report

## 🔍 Usage Examples

### Triggering a Release

1. Create a new GitHub Release
2. Workflow automatically triggers
3. Detects changed policies since baseline
4. Validates and publishes each policy
5. Updates state for successful deliveries

### Manual Testing

```bash
# Test policy detection
cd .github/actions/detect-changed-policies
node index.js

# Test policy validation
cd .github/actions/validate-policy
node index.js

# Test delivery status check
cd .github/actions/check-delivery-status
node index.js
```

### Viewing State

```bash
# Check baseline
cat .state/baseline.sha

# Check delivered policies
cat .state/delivered.json | jq '.'

# Check specific policy
cat .state/delivered.json | jq '.["policies/rate-limiter/v1.0.0"]'
```

## 🐛 Troubleshooting

### Problem: Policy not detected

**Cause**: Changes not in `policies/<name>/v<version>/` format

**Solution**: Ensure policy folders follow naming convention

### Problem: Policy published but state not updated

**Cause**: State update step failed after publishing

**Solution**: State will be corrected on next run (idempotency protects against duplicates)

### Problem: All policies being re-published

**Cause**: `baseline.sha` pointing to wrong commit

**Solution**: 
```bash
# Reset baseline to last successful release
git rev-list -1 <last-successful-tag> > .state/baseline.sha
```

### Problem: API timeout errors

**Cause**: API responding slowly

**Solution**: Increase timeout in workflow configuration

## 🚀 Benefits

✅ **No data loss**: Failed deliveries are automatically retried  
✅ **No duplicate deliveries**: Idempotency ensures safety  
✅ **Safe retries**: Failed policies retry without affecting successful ones  
✅ **Partial success support**: Some policies can fail without blocking others  
✅ **Scalability**: Parallelism handles many policies efficiently  
✅ **Auditability**: Git-tracked state provides complete history  
✅ **Maintainability**: JavaScript actions are easier to test and debug  

## 📚 Related Documentation

- [Configurable Validation](./CONFIGURABLE_VALIDATION.md)
- [State Management](./.state/README.md)
- [GitHub Actions Workflow](./.github/workflows/batch-release.yml)

## 🔮 Future Enhancements

- [ ] External state store (S3 / Azure Blob) for large-scale deployments
- [ ] Content hash-based detection instead of commit SHA
- [ ] Advanced retry strategies with exponential backoff
- [ ] Delivery metrics and observability dashboard
- [ ] Policy dependency management
- [ ] Multi-environment deployment support
- [ ] Webhook notifications for delivery status

---

**Version**: 2.0.0  
**Last Updated**: December 2025  
**Architecture**: JavaScript-based with folder-level state management
