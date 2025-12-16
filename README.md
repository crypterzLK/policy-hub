# Policy Hub Repository

**Reliable, idempotent, and failure-safe policy delivery system** triggered by GitHub Releases. Built with JavaScript actions and folder-level state management for granular reliability.

## ✨ Features

- 🎯 **Folder-Level Reliability**: Per-policy tracking and retry
- 🔄 **Idempotent Delivery**: Safe to run multiple times, no duplicates
- 🚀 **Parallel Processing**: Concurrent validation and publishing (configurable)
- 🛡️ **Failure-Safe**: Failed policies auto-retry on next release
- 💾 **State Management**: Git-tracked baseline and delivery state
- 🔍 **Smart Detection**: Changed policies since baseline commit
- ✅ **Comprehensive Validation**: Structure, metadata, and documentation checks
- 📊 **Rich Observability**: Detailed summaries and progress tracking
- 🔐 **API Idempotency**: Commit SHA-based deduplication

## 🏗️ Architecture

This system implements the **reliable folder-based delivery pattern**:

1. **Baseline Tracking**: `.state/baseline.sha` tracks the starting point
2. **Delivery State**: `.state/delivered.json` records successful deliveries per folder
3. **Change Detection**: Git diff identifies changed policies since baseline
4. **Eligibility Check**: Compares current SHA with delivered SHA
5. **Idempotent Publishing**: Commit SHA ensures no duplicate deliveries
6. **State Update**: Success recorded in delivered.json for future runs

See [Architecture Documentation](./ARCHITECTURE.md) for complete details.

## 🚀 Quick Start

### Prerequisites

- GitHub repository with policies in `policies/<name>/v<version>/` format
- Policy Hub API endpoint
- API authentication key

### Initial Setup

1. **Configure Repository Variables** (Settings → Secrets and variables → Actions)

2. **Initialize State** (automatically done on first release)

3. **Create a Release** to trigger the workflow

## Required Secrets and Variables

### Repository Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `POLICY_HUB_API_KEY` | API key for Policy Hub authentication | ✅ Yes |
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions | ✅ Auto |

### Repository Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POLICY_HUB_API_URL` | Policy Hub API base URL | - | ✅ Yes |
| `MAX_PARALLEL` | Maximum parallel jobs | `3` | ❌ Optional |
| `AWS_REGION` | AWS region (if using AWS features) | - | ❌ Optional |

## 📂 Repository Structure

```
.
├── .state/                          # State management (Git-tracked)
│   ├── baseline.sha                 # Baseline commit for change detection
│   ├── delivered.json               # Per-folder delivery tracking
│   └── README.md                    # State documentation
├── .github/
│   ├── actions/                     # JavaScript actions (Node.js 20)
│   │   ├── detect-changed-policies/ # Detects changed policy folders
│   │   ├── validate-policy/         # Validates policy structure
│   │   ├── check-delivery-status/   # Checks if already delivered
│   │   ├── publish-policy/          # Publishes to Policy Hub API
│   │   └── update-delivery-state/   # Updates delivery state
│   └── workflows/
│       └── batch-release.yml        # Main release workflow
├── policies/                        # Policy folders
│   └── <policy-name>/
│       └── v<version>/
│           ├── metadata.json
│           ├── policy-definition.yaml
│           ├── docs/
│           └── src/
├── config/
│   └── policy-hub-config.json       # Configuration file
├── ARCHITECTURE.md                  # Architecture documentation
├── MIGRATION.md                     # Migration guide
└── README.md                        # This file
```

## 📋 Policy Structure Requirements

Each policy version must follow this structure:

```
policies/<policy-name>/v<version>/
├── metadata.json               # Required: Policy metadata
├── policy-definition.yaml      # Required: Policy definition
├── docs/                       # Required: Documentation directory
│   ├── overview.md            # Required
│   ├── configuration.md       # Required
│   ├── examples.md            # Required
│   ├── changelog.md           # Recommended
│   └── faq.md                 # Recommended
└── src/                       # Required: Source code directory
    └── main.go                # At least one source file
```

### Version Format
- Must follow semantic versioning: `v<major>.<minor>.<patch>`
- Examples: `v1.0.0`, `v1.1.0`, `v2.0.0`

### metadata.json Schema
```json
{
  "name": "rate-limiter",
  "version": "v1.0.0",
  "description": "Rate limiting policy for API requests",
  "author": "Platform Team",
  "category": "traffic-management",
  "tags": ["rate-limiting", "api", "protection"],
  "documentation": "https://docs.example.com/policies/rate-limiter"
}
```

### policy-definition.yaml Schema
```yaml
apiVersion: policy/v1
kind: Policy
metadata:
  name: rate-limiter
  version: v1.0.0
spec:
  type: rate-limiting
  configuration:
    maxRequests: 100
    windowSeconds: 60
  enforcement: hard
```

## 🔄 Workflow Overview

### Batch Release Workflow

**Trigger**: GitHub Release published

**Jobs**:

1. **Initialize** - Get or create baseline SHA
2. **Detect Policies** - Find changed policies since baseline
3. **Validate & Check** - Parallel validation and delivery status check
4. **Publish Policies** - Parallel publishing with idempotency
5. **Finalize State** - Merge and commit delivery state
6. **Summary** - Generate release report

**Behavior**:

| Scenario | Action |
|----------|--------|
| New policy | ✅ Validate and publish |
| Changed policy (SHA different) | ✅ Validate and publish |
| Already published (SHA same) | ⏭️ Skip |
| Validation fails | ❌ Stop for that policy |
| Publishing fails | ❌ Retry on next release |
| Partial success | ✅ Successful policies saved, failed ones retry |

## 🚀 Usage

### Creating a Release

```bash
# Create and push a new tag
git tag v1.2.0
git push origin v1.2.0

# Create release via GitHub CLI
gh release create v1.2.0 \
  --title "Release v1.2.0" \
  --notes "Added rate-limiter v1.0.1 and quota v2.0.0"

# Or create via GitHub UI
# Go to Releases → Create new release
```

### Monitoring Execution

1. Go to **Actions** tab
2. Find **Batch Release** workflow run
3. Review job summaries:
   - Policy detection count
   - Validation results per policy
   - Publishing status per policy
   - Final delivery state

### Checking State

```bash
# View baseline
cat .state/baseline.sha

# View all delivered policies
cat .state/delivered.json | jq '.'

# Check specific policy
cat .state/delivered.json | jq '.["policies/rate-limiter/v1.0.0"]'

# Count delivered policies
cat .state/delivered.json | jq 'keys | length'
```

## 🐛 Troubleshooting

### Policy Not Detected

**Issue**: Changed policy not showing in detection

**Solutions**:
- Ensure folder format: `policies/<name>/v<version>/`
- Check baseline SHA is correct: `cat .state/baseline.sha`
- Verify changes are committed and pushed

### Policy Fails Validation

**Issue**: Validation errors prevent publishing

**Solutions**:
- Check required files exist
- Validate metadata.json format
- Ensure version matches folder name
- Review validation logs in Actions

### Publishing Fails

**Issue**: API returns error

**Solutions**:
- Check `POLICY_HUB_API_KEY` secret is set
- Verify `POLICY_HUB_API_URL` variable
- Review API response in logs
- Check network/firewall settings

### State Not Updating

**Issue**: delivered.json not reflecting successful deliveries

**Solutions**:
- Check finalize-state job succeeded
- Verify GitHub token has push permissions
- Pull latest changes: `git pull origin main`
- Check for merge conflicts in .state/

## 📚 Documentation

- **[Architecture Guide](./ARCHITECTURE.md)** - Complete system architecture and design
- **[Migration Guide](./MIGRATION.md)** - Migrating from old bash-based system
- **[State Management](./.state/README.md)** - Understanding baseline and delivered.json
- **[Configurable Validation](./CONFIGURABLE_VALIDATION.md)** - Validation rules

## 🔮 Advanced Features

### Parallel Processing Control

Control concurrency via `MAX_PARALLEL` variable:

```yaml
# .github/workflows/batch-release.yml
env:
  MAX_PARALLEL: ${{ vars.MAX_PARALLEL || 3 }}
```

### Idempotency

Publishing uses commit SHA as idempotency key:

```javascript
headers: {
  'X-Idempotency-Key': commitSha
}
```

API returns 409 for duplicate requests (treated as success).

### State Merging

Multiple parallel jobs update state independently. Final job merges all states:

```javascript
// Merge strategy: newer entries win
Object.assign(mergedState, newState);
```

## 🤝 Contributing

1. Create feature branch
2. Add/modify policies in `policies/`
3. Ensure validation passes locally
4. Create pull request
5. Merge after approval
6. Create release to trigger deployment

## 📊 Benefits

| Feature | Benefit |
|---------|---------|
| **Folder-level tracking** | Failed policies don't block others |
| **Idempotency** | Safe to retry without duplicates |
| **Parallel processing** | Faster execution for many policies |
| **Git-tracked state** | Full audit trail and history |
| **JavaScript actions** | Easier to maintain and debug |
| **Automatic retry** | Failed deliveries retry next release |
| **Comprehensive validation** | Catch errors before API calls |

## 📝 License

[Add your license here]

## 🆘 Support

For issues or questions:
- Check [Troubleshooting](#-troubleshooting) section
- Review [Architecture Documentation](./ARCHITECTURE.md)
- Check workflow logs in GitHub Actions
- Create an issue with detailed description

---

**Version**: 2.0.0  
**Architecture**: JavaScript-based with folder-level state management  
**Last Updated**: December 2025
- **Actions**:
  - Validates policy structure and required files
  - Checks semantic versioning format
  - Detects new policy versions in PR
  - Comments on PR with validation results

### 2. Batch Release (`batch-release.yml`)
- **Trigger**: GitHub release publication
- **Actions**:
  - Detects new policy versions since last release
  - Publishes policies in parallel (max 3 concurrent)
  - Packages source code into ZIP files
  - Uploads artifacts to S3
  - Syncs metadata with Policy Hub API

### 3. Script Testing (`test-scripts.yml`)
- **Trigger**: Changes to scripts or test workflow
- **Actions**:
  - Tests `prepare-zip.sh` with various inputs and edge cases
  - Tests `validate-config.sh` with valid and invalid configurations
  - Validates error handling and input validation

## Usage

### Adding a New Policy Version

1. **Create Policy Structure**:
   ```bash
   mkdir -p policies/my-policy/v1.0.0/{src,docs}
   ```

2. **Add Required Files**:
   - `policies/my-policy/v1.0.0/metadata.json`
   - `policies/my-policy/v1.0.0/policy-definition.yaml`
   - `policies/my-policy/v1.0.0/src/main.go` (and other Go files)

3. **Create Pull Request**:
   - The PR validation workflow will check your policy structure
   - Fix any validation errors reported in PR comments

4. **Create Release**:
   - After PR merge, create a GitHub release
   - The batch release workflow will automatically publish new versions

### API Payload Structure

When publishing to Policy Hub, the following JSON payload is sent:

```json
{
  "policyName": "my-policy",
  "version": "v1.0.0",
  "sourceType": "github",
  "sourceUrl": "https://github.com/org/repo",
  "definitionUrl": "https://github.com/org/repo/raw/main/policies/my-policy/v1.0.0/policy-definition.yaml",
  "metadata": {
    "name": "my-policy",
    "version": "v1.0.0",
    "description": "My policy description"
  },
  "docsBaseUrl": "https://github.com/org/repo/raw/main/policies/my-policy/v1.0.0/docs/",
  "assetsBaseUrl": "https://github.com/org/repo/raw/main/policies/my-policy/v1.0.0/assets/"
}
```

## Configuration

The `config/policy-hub-config.json` file contains configuration options:

```json
{
  "s3": {
    "path": "policies/",
    "storageClass": "STANDARD"
  },
  "policyHub": {
    "timeout": 30,
    "retryAttempts": 3
  },
  "validation": {
    "requiredFiles": ["metadata.json", "policy-definition.yaml"],
    "requiredDirs": ["src", "docs"],
    "versionRegex": "^v[0-9]+\\.[0-9]+\\.[0-9]+$"
  },
  "processing": {
    "maxParallelJobs": 3
  }
}
```

## Development

### Testing Scripts Locally

```bash
# Test prepare-zip.sh
mkdir -p test/policies/test-policy/v1.0.0/src
echo 'package main; func main() {}' > test/policies/test-policy/v1.0.0/src/main.go
cd test
../scripts/prepare-zip.sh test-policy v1.0.0
```

### Running Tests

Tests run automatically on:
- Push to `main` or `develop` branches affecting scripts
- Pull requests affecting scripts

## Troubleshooting

### Common Issues

1. **"Source directory not found"**
   - Ensure `policies/<policy>/<version>/src/` directory exists
   - Check that the directory contains Go files

2. **"Invalid version format"**
   - Version must be in format `vX.Y.Z` (e.g., `v1.0.0`)
   - Check for typos in version directory name

3. **"S3 upload failed"**
   - Verify AWS credentials are configured correctly
   - Check S3 bucket permissions
   - Ensure bucket exists in specified region

4. **"Policy Hub sync failed"**
   - Verify API key is valid and has necessary permissions
   - Check API endpoint URL
   - Review API rate limits

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository settings.

## Security Considerations

- AWS credentials are stored as GitHub secrets
- API keys use Bearer token authentication
- Input validation prevents path traversal attacks
- Parallel processing includes rate limiting
- Temporary files are cleaned up after processing
- **Policy artifacts in S3 are never deleted** - they are immutable releases preserved for audit trails, compliance, and rollback purposes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
