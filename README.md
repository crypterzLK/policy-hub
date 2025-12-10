# Policy Hub Repository

Batch publishing of policy versions via GitHub releases with robust error handling, parallel processing, and comprehensive validation.

## Features

- 🚀 **Parallel Processing**: Publish multiple policy versions concurrently (up to 3 parallel jobs)
- 🛡️ **Robust Error Handling**: Individual version failures don't stop batch processing
- 🔍 **Smart Version Detection**: Git-based detection of new policy versions
- 📦 **Automated Packaging**: ZIP creation with validation and integrity checks
- ☁️ **Cloud Storage**: S3 integration for artifact storage
- 🔗 **API Integration**: Seamless sync with Policy Hub API
- ✅ **Comprehensive Testing**: Automated testing for scripts and workflows
- 📋 **PR Validation**: Automated validation of policy structure in pull requests

## Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 operations | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 operations | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWS region for S3 bucket | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket for storing policy artifacts | `my-policy-artifacts` |
| `POLICY_HUB_API_URL` | Policy Hub API base URL | `https://api.policyhub.com` |
| `POLICY_HUB_API_KEY` | API key for Policy Hub authentication | `ph_1234567890abcdef` |

## Repository Structure

```
.
├── .github/
│   ├── actions/
│   │   ├── publish-policy/          # Composite action for publishing
│   │   └── detect-versions/         # Composite action for version detection
│   └── workflows/
│       ├── batch-release.yml        # Main publishing workflow
│       ├── pr-validate.yml          # PR validation workflow
│       └── test-scripts.yml         # Script testing workflow
├── config/
│   └── policy-hub-config.json       # Configuration file
├── scripts/
│   ├── prepare-zip.sh               # ZIP preparation script
│   └── validate-config.sh           # Configuration validation script
├── policies/                        # Policy definitions (created by users)
│   └── <policy-name>/
│       └── <version>/
│           ├── src/                 # Go source code
│           ├── docs/                # Documentation
│           ├── metadata.json        # Policy metadata
│           └── policy-definition.yaml # Policy definition
└── README.md
```

## Policy Structure Requirements

Each policy version must follow this structure:

```
policies/<policy-name>/<version>/
├── src/                    # Required: Go source code directory
│   └── *.go               # At least one .go file required
├── docs/                   # Required: Documentation directory
├── metadata.json          # Required: Policy metadata
└── policy-definition.yaml # Required: Policy definition
```

### Version Format
- Must follow semantic versioning: `vX.Y.Z` (e.g., `v1.0.0`, `v2.1.3`)
- Examples: `v1.0.0`, `v1.1.0`, `v2.0.0`

### metadata.json Example
```json
{
  "name": "network-policy",
  "version": "v1.0.0",
  "description": "Network access control policy",
  "author": "Security Team",
  "tags": ["network", "security"],
  "compatibility": ">=v1.0.0"
}
```

### policy-definition.yaml Example
```yaml
apiVersion: policy/v1
kind: Policy
metadata:
  name: network-policy
spec:
  rules:
    - name: allow-internal
      condition: "source.internal == true"
      action: allow
    - name: deny-external
      condition: "source.external == true"
      action: deny
```

## Workflows

### 1. PR Validation (`pr-validate.yml`)
- **Trigger**: Pull requests affecting `policies/**`
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
