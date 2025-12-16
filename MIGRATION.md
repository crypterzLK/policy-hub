# Migration Guide: Bash to JavaScript Architecture

## Overview

This guide helps you migrate from the old bash-based workflow to the new JavaScript-based architecture with folder-level state management.

## What Changed

### Architecture Changes

| Aspect | Old (Bash) | New (JavaScript) |
|--------|-----------|------------------|
| **Actions Language** | Bash scripts | JavaScript (Node.js 20) |
| **State Tracking** | `last-successful-release.sha` | `.state/baseline.sha` + `.state/delivered.json` |
| **Failure Handling** | Release-level retry | Folder-level retry |
| **Validation** | Sequential bash script | Parallel JavaScript action |
| **API Calls** | curl in bash | Node.js https module |
| **Idempotency** | Not implemented | Commit SHA-based idempotency |

### File Structure Changes

**Removed:**
```
.github/actions/detect-versions/
.github/actions/check-policy-existence/
.github/actions/update-delivered/
scripts/validate-policy.sh
last-successful-release.sha
```

**Added:**
```
.state/
  ├── baseline.sha
  ├── delivered.json
  └── README.md
  
.github/actions/
  ├── detect-changed-policies/
  ├── validate-policy/
  ├── check-delivery-status/
  ├── publish-policy/
  └── update-delivery-state/
  
ARCHITECTURE.md
MIGRATION.md
```

## Migration Steps

### Step 1: Backup Current State

```bash
# Backup old workflow and state
cp .github/workflows/batch-release.yml .github/workflows/batch-release.yml.backup
cp last-successful-release.sha last-successful-release.sha.backup 2>/dev/null || true

# Create backup branch
git checkout -b backup-old-architecture
git add -A
git commit -m "backup: old bash-based architecture"
git checkout main
```

### Step 2: Initialize New State

```bash
# Create state directory
mkdir -p .state

# Initialize baseline from last successful release
# Option A: If you have last-successful-release.sha
if [ -f last-successful-release.sha ]; then
  cp last-successful-release.sha .state/baseline.sha
fi

# Option B: Start from current HEAD
git rev-parse HEAD > .state/baseline.sha

# Option C: Start from specific release tag
git rev-list -1 v1.0.0 > .state/baseline.sha

# Initialize empty delivered state
echo '{}' > .state/delivered.json
```

### Step 3: Remove Old Components

```bash
# Remove old actions
rm -rf .github/actions/detect-versions
rm -rf .github/actions/check-policy-existence
rm -rf .github/actions/update-delivered

# Remove old tracking file
rm -f last-successful-release.sha

# Note: Keep scripts/ if you use them for local validation
```

### Step 4: Pull New Code

```bash
# Pull the new architecture from main branch
git pull origin main

# Or apply the changes manually if in separate branch
```

### Step 5: Install Dependencies

```bash
# Install npm dependencies for all actions
for dir in .github/actions/*/; do
  echo "Installing dependencies for $(basename $dir)..."
  (cd "$dir" && npm install --production)
done
```

### Step 6: Configure Environment

**Update Repository Variables:**

Go to Settings → Secrets and variables → Actions → Variables

- ✅ `POLICY_HUB_API_URL` - Already configured
- ✅ `AWS_REGION` - Already configured
- ➕ `MAX_PARALLEL` - Add (optional, default: 3)

**Update Repository Secrets:**

Go to Settings → Secrets and variables → Actions → Secrets

- ✅ `POLICY_HUB_API_KEY` - Already configured
- ✅ `GITHUB_TOKEN` - Automatically provided

### Step 7: Commit State Files

```bash
# Add new state directory
git add .state/

# Add new actions and workflow
git add .github/

# Add documentation
git add ARCHITECTURE.md MIGRATION.md

# Commit changes
git commit -m "feat: migrate to JavaScript-based architecture with folder-level state management"

# Push to repository
git push origin main
```

### Step 8: Test with Dry Run

Before creating a real release, test the workflow:

```bash
# Method 1: Manual workflow dispatch (if enabled)
# Go to Actions → Batch Release → Run workflow

# Method 2: Create a test release
git tag v0.0.0-test
git push origin v0.0.0-test
gh release create v0.0.0-test --title "Test Release" --notes "Testing new architecture"
```

### Step 9: Verify Execution

1. Go to Actions tab in GitHub
2. Find the "Batch Release" workflow run
3. Check each job:
   - ✅ Initialize Baseline & State
   - ✅ Detect Changed Policies
   - ✅ Validate & Check (per policy)
   - ✅ Publish Policies (per policy)
   - ✅ Finalize State
   - ✅ Release Summary

4. Review job summaries for detailed reports

### Step 10: Verify State Updates

```bash
# Pull latest changes
git pull origin main

# Check baseline
cat .state/baseline.sha

# Check delivered policies
cat .state/delivered.json | jq '.'

# Verify entries
cat .state/delivered.json | jq 'keys'
```

## State Migration Scenarios

### Scenario 1: First Time Setup (No Previous State)

```bash
# Initialize baseline to repository root
git rev-list --max-parents=0 HEAD > .state/baseline.sha

# All policies will be detected as new
echo '{}' > .state/delivered.json
```

### Scenario 2: Continuing from Last Successful Release

```bash
# Copy old tracking file
cp last-successful-release.sha .state/baseline.sha

# Initialize empty delivered state
# (First run will populate it with successful deliveries)
echo '{}' > .state/delivered.json
```

### Scenario 3: Partial Migration with Existing Deliveries

If you want to mark some policies as already delivered:

```bash
# Create initial delivered state manually
cat > .state/delivered.json << 'EOF'
{
  "policies/rate-limiter/v1.0.0": {
    "sha": "abc123",
    "deliveredAt": "2025-12-01T00:00:00Z",
    "release": "v1.0.0"
  }
}
EOF

# Get actual commit SHAs
git log -1 --format=%H -- policies/rate-limiter/v1.0.0
```

## Rollback Procedure

If you need to rollback to the old architecture:

```bash
# Restore old workflow
git checkout backup-old-architecture -- .github/workflows/batch-release.yml

# Restore old actions
git checkout backup-old-architecture -- .github/actions/

# Restore old tracking file
git checkout backup-old-architecture -- last-successful-release.sha

# Remove new state directory
rm -rf .state/

# Commit rollback
git add -A
git commit -m "rollback: restore old bash-based architecture"
git push origin main
```

## Troubleshooting

### Issue: Baseline SHA Not Found

**Symptoms**: Error "Baseline SHA does not exist in repository"

**Solution**:
```bash
# Reset to valid SHA
git rev-parse HEAD > .state/baseline.sha
git add .state/baseline.sha
git commit -m "fix: reset baseline SHA"
git push
```

### Issue: npm install Failures

**Symptoms**: "Cannot find module '@actions/core'"

**Solution**:
```bash
# Reinstall dependencies
cd .github/actions/detect-changed-policies
rm -rf node_modules package-lock.json
npm install --production

# Repeat for other actions
```

### Issue: State File Conflicts

**Symptoms**: Merge conflicts in .state/delivered.json

**Solution**:
```bash
# Accept remote version (newer state)
git checkout --theirs .state/delivered.json

# Or merge manually using jq
jq -s '.[0] * .[1]' .state/delivered.json.local .state/delivered.json.remote > .state/delivered.json
```

### Issue: All Policies Being Republished

**Symptoms**: Policies marked as "never-delivered" despite previous success

**Solution**:
```bash
# delivered.json is empty or corrupt
# Option 1: Let them republish (idempotency protects against duplicates)
# Option 2: Manually reconstruct delivered.json from git history

for policy in policies/*/v*/; do
  sha=$(git log -1 --format=%H -- "$policy")
  echo "\"$policy\": {\"sha\": \"$sha\", \"deliveredAt\": \"$(date -Iseconds)\", \"release\": \"manual\"}"
done
```

## Validation

After migration, validate the new system:

### ✅ Checklist

- [ ] `.state/baseline.sha` exists and contains valid SHA
- [ ] `.state/delivered.json` exists and is valid JSON
- [ ] All actions have `node_modules/` directories
- [ ] Workflow file is updated
- [ ] Environment variables configured
- [ ] Secrets configured
- [ ] Test release successful
- [ ] State files committed to repository
- [ ] Documentation reviewed

### Test Commands

```bash
# Validate state files
test -f .state/baseline.sha && echo "✅ baseline.sha exists"
test -f .state/delivered.json && echo "✅ delivered.json exists"
cat .state/delivered.json | jq '.' > /dev/null && echo "✅ delivered.json is valid JSON"

# Validate actions
for dir in .github/actions/*/; do
  test -d "$dir/node_modules" && echo "✅ $(basename $dir) has dependencies"
done

# Validate workflow
cat .github/workflows/batch-release.yml | grep "detect-changed-policies" > /dev/null && echo "✅ Workflow uses new actions"
```

## Benefits After Migration

✅ **Easier debugging**: JavaScript is more maintainable than bash  
✅ **Better error handling**: Structured error messages and summaries  
✅ **Granular retry**: Failed policies retry individually  
✅ **Idempotency**: Safe to run multiple times  
✅ **Parallel processing**: Faster execution with controlled concurrency  
✅ **State visibility**: Clear tracking of what was delivered  
✅ **Type safety**: Package.json and dependencies managed properly  

## Support

If you encounter issues during migration:

1. Check the [Architecture Documentation](./ARCHITECTURE.md)
2. Review [State Management README](./.state/README.md)
3. Check workflow run logs in GitHub Actions
4. Create an issue with:
   - Migration step where error occurred
   - Error messages and logs
   - Current state of `.state/` directory

---

**Migration Version**: 1.0.0  
**Target Architecture**: JavaScript-based v2.0.0  
**Last Updated**: December 2025
