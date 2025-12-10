# Configurable Policy Validation System

## Overview

The Policy Hub now features a fully configurable validation system that allows you to customize validation requirements without modifying code. All validation rules are centralized in `config/policy-hub-config.json` and used consistently across PR validation and release workflows.

## Key Features

### 🔧 Configurable Requirements
- **Required Files**: Customize which files must be present in each policy
- **Required Directories**: Define mandatory directory structure
- **Documentation Requirements**: Specify required documentation files
- **Metadata Fields**: Configure required metadata.json fields
- **Validation Strictness**: Toggle between strict and permissive validation modes
- **File Extensions**: Control allowed file types
- **Naming Rules**: Set policy name length limits and version format patterns

### 🚀 Integrated Workflows
- **PR Validation**: Automatically validates policies in pull requests using configurable rules
- **Pre-Release Validation**: Validates all policies before publishing to prevent broken releases
- **Consistent Validation**: Same validation logic used across all processes

### 🛠 Management Tools
- **validate-policy.sh**: Validate individual policies with current configuration
- **manage-config.sh**: View and modify configuration settings
- **validate-config.sh**: Validate configuration file syntax and structure

## Configuration Structure

```json
{
  "validation": {
    "requiredFiles": ["metadata.json", "policy-definition.yaml"],
    "requiredDirs": ["src", "docs"],
    "requiredDocsFiles": ["overview.md", "configuration.md", "examples.md"],
    "requiredMetadataFields": ["name", "displayName", "provider", "categories", "description", "version"],
    "optionalDirs": ["assets"],
    "versionRegex": "^v[0-9]+\\.[0-9]+\\.[0-9]+$",
    "maxPolicyNameLength": 50,
    "strictValidation": true,
    "allowedExtensions": [".go", ".yaml", ".yml", ".json", ".md"]
  }
}
```

## Usage Examples

### Validate a Policy Locally
```bash
./scripts/validate-policy.sh my-policy v1.2.0
```

### View Current Configuration
```bash
./scripts/manage-config.sh list
```

### Update Configuration
```bash
# Add a new required metadata field
./scripts/manage-config.sh set validation.requiredMetadataFields '["name","displayName","provider","categories","description","version","author"]'

# Change validation strictness
./scripts/manage-config.sh set validation.strictValidation false

# Add new required documentation file
./scripts/manage-config.sh set validation.requiredDocsFiles '["overview.md","configuration.md","examples.md","troubleshooting.md"]'
```

### Validate Configuration Changes
```bash
./scripts/validate-config.sh
```

## Workflow Integration

### PR Validation Process
1. **Detection**: Automatically detects new or modified policies in PR
2. **Configurable Validation**: Runs validation using current configuration rules
3. **Feedback**: Provides detailed feedback with current configuration context
4. **Blocking**: Prevents merge if validation fails

### Release Process  
1. **Pre-Release Validation**: Validates all policies before publishing
2. **Blocking**: Prevents release if any policy fails validation
3. **Consistent Rules**: Uses same configuration as PR validation
4. **Clear Feedback**: Shows which policies failed and why

## Benefits

1. **Flexibility**: Change validation requirements without code changes
2. **Consistency**: Same rules applied across PR review and release processes
3. **Transparency**: Clear visibility into current validation requirements
4. **Maintainability**: Easy to update requirements as policies evolve
5. **Reliability**: Pre-release validation prevents broken policy releases

## Migration from Hardcoded Rules

The system has been migrated from hardcoded validation rules to fully configurable validation:

- **Before**: Validation rules were embedded in workflow files and scripts
- **After**: All rules centralized in `policy-hub-config.json`
- **Compatibility**: Default configuration matches previous hardcoded requirements
- **Enhancement**: Additional configuration options available for fine-tuning

## Testing

The configurable validation system includes comprehensive tests:

- **Unit Tests**: Test individual validation components
- **Integration Tests**: Test end-to-end validation workflows  
- **Configuration Tests**: Verify configuration parsing and validation
- **Action Tests**: Simulate GitHub Actions workflow behavior

Run tests with:
```bash
bash test/run-tests.sh
```

## Best Practices

1. **Configuration Changes**: Always validate configuration after changes using `validate-config.sh`
2. **Testing**: Test validation changes with sample policies before deploying
3. **Documentation**: Update team documentation when changing validation requirements
4. **Versioning**: Consider the impact of validation changes on existing policies
5. **Gradual Migration**: Use permissive mode during transitions to stricter requirements