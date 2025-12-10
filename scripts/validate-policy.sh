#!/bin/bash

# Configurable policy validation script
# Reads validation requirements from config/policy-hub-config.json

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="${CONFIG_FILE:-$REPO_ROOT/config/policy-hub-config.json}"
POLICY_PATH="${1:-}"
VERSION="${2:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

validate_config_exists() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        log_error "Invalid JSON in configuration file: $CONFIG_FILE"
        exit 1
    fi
}

get_config_array() {
    local key="$1"
    jq -r ".validation.$key[]" "$CONFIG_FILE" 2>/dev/null || echo ""
}

get_config_value() {
    local key="$1"
    jq -r ".validation.$key" "$CONFIG_FILE" 2>/dev/null || echo "null"
}

validate_policy_structure() {
    local policy_dir="$1"
    local errors=0

    echo "🔍 Validating policy structure for: $policy_dir"

    # Check required files
    while IFS= read -r file; do
        if [ -n "$file" ] && [ ! -f "$policy_dir/$file" ]; then
            log_error "Required file missing: $file"
            ((errors++))
        else
            log_success "Required file found: $file"
        fi
    done <<< "$(get_config_array "requiredFiles")"

    # Check required directories  
    while IFS= read -r dir; do
        if [ -n "$dir" ] && [ ! -d "$policy_dir/$dir" ]; then
            log_error "Required directory missing: $dir"
            ((errors++))
        else
            log_success "Required directory found: $dir"
        fi
    done <<< "$(get_config_array "requiredDirs")"

    # Check required docs files
    while IFS= read -r doc; do
        if [ -n "$doc" ] && [ ! -f "$policy_dir/docs/$doc" ]; then
            log_error "Required docs file missing: docs/$doc"
            ((errors++))
        else
            log_success "Required docs file found: docs/$doc"
        fi
    done <<< "$(get_config_array "requiredDocsFiles")"

    # Check optional directories (warn if missing)
    while IFS= read -r dir; do
        if [ -n "$dir" ]; then
            if [ -d "$policy_dir/$dir" ]; then
                log_success "Optional directory found: $dir"
            else
                log_warning "Optional directory missing: $dir"
            fi
        fi
    done <<< "$(get_config_array "optionalDirs")"

    return $errors
}

validate_metadata() {
    local metadata_file="$1"
    local errors=0

    echo "🔍 Validating metadata: $metadata_file"

    if [ ! -f "$metadata_file" ]; then
        log_error "Metadata file not found: $metadata_file"
        return 1
    fi

    # Validate JSON syntax
    if ! jq empty "$metadata_file" 2>/dev/null; then
        log_error "Invalid JSON syntax in metadata file"
        return 1
    fi

    # Check required metadata fields
    while IFS= read -r field; do
        if [ -n "$field" ]; then
            if jq -e ".$field" "$metadata_file" >/dev/null 2>&1; then
                local value=$(jq -r ".$field" "$metadata_file")
                if [ "$value" = "null" ] || [ -z "$value" ]; then
                    log_error "Required metadata field is null or empty: $field"
                    ((errors++))
                else
                    log_success "Required metadata field found: $field = $value"
                fi
            else
                log_error "Required metadata field missing: $field"
                ((errors++))
            fi
        fi
    done <<< "$(get_config_array "requiredMetadataFields")"

    return $errors
}

validate_version_format() {
    local version="$1"
    local version_regex
    
    version_regex=$(get_config_value "versionRegex")
    
    if [ "$version_regex" != "null" ]; then
        if echo "$version" | grep -qE "$version_regex"; then
            log_success "Version format is valid: $version"
            return 0
        else
            log_error "Invalid version format: $version (expected pattern: ${version_regex})"
            return 1
        fi
    fi
    
    return 0
}

validate_policy_name() {
    local name="$1"
    local max_length
    
    max_length=$(get_config_value "maxPolicyNameLength")
    
    if [ "$max_length" != "null" ] && [ "${#name}" -gt "$max_length" ]; then
        log_error "Policy name too long: ${#name} characters (max: $max_length)"
        return 1
    fi
    
    # Check for valid characters (alphanumeric, hyphens, underscores)
    if [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        log_error "Invalid policy name format: $name (only alphanumeric, hyphens, underscores allowed)"
        return 1
    fi
    
    log_success "Policy name is valid: $name"
    return 0
}

print_config_summary() {
    echo "📋 Current validation configuration:"
    echo "   Required files: $(get_config_array "requiredFiles" | tr '\n' ', ' | sed 's/,$//')"
    echo "   Required directories: $(get_config_array "requiredDirs" | tr '\n' ', ' | sed 's/,$//')"  
    echo "   Required docs files: $(get_config_array "requiredDocsFiles" | tr '\n' ', ' | sed 's/,$//')"
    echo "   Required metadata fields: $(get_config_array "requiredMetadataFields" | tr '\n' ', ' | sed 's/,$//')"
    echo "   Optional directories: $(get_config_array "optionalDirs" | tr '\n' ', ' | sed 's/,$//')"
    echo "   Version regex: $(get_config_value "versionRegex")"
    echo "   Max policy name length: $(get_config_value "maxPolicyNameLength")"
    echo ""
}

main() {
    if [ -z "$POLICY_PATH" ]; then
        echo "Usage: $0 <policy-name> [version]"
        echo ""
        echo "This script validates policy structure based on configurable requirements."
        echo "Configuration is read from: $CONFIG_FILE"
        echo ""
        validate_config_exists
        print_config_summary
        exit 1
    fi

    validate_config_exists
    
    if [ "$(get_config_value "strictValidation")" = "false" ]; then
        echo "🔧 Running in permissive mode (strictValidation: false)"
    fi

    local policy_name="$POLICY_PATH"
    local version="${VERSION:-v1.0.0}"
    local policy_dir="$REPO_ROOT/policies/$policy_name/$version"
    local total_errors=0

    echo "🚀 Starting configurable policy validation..."
    print_config_summary

    # Validate policy name
    if ! validate_policy_name "$policy_name"; then
        ((total_errors++))
    fi

    # Validate version format
    if ! validate_version_format "$version"; then
        ((total_errors++))
    fi

    # Check if policy directory exists
    if [ ! -d "$policy_dir" ]; then
        log_error "Policy directory not found: $policy_dir"
        exit 1
    fi

    # Validate policy structure
    validate_policy_structure "$policy_dir"
    structure_errors=$?
    total_errors=$((total_errors + structure_errors))

    # Validate metadata
    validate_metadata "$policy_dir/metadata.json"
    metadata_errors=$?
    total_errors=$((total_errors + metadata_errors))

    echo ""
    if [ $total_errors -eq 0 ]; then
        log_success "🎉 Policy validation passed! All configurable requirements met."
        exit 0
    else
        log_error "💥 Policy validation failed with $total_errors error(s)."
        if [ "$(get_config_value "strictValidation")" = "false" ]; then
            log_warning "Continuing due to permissive validation mode."
            exit 0
        fi
        exit 1
    fi
}

main "$@"