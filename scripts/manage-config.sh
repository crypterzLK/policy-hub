#!/bin/bash

# Configuration management script for Policy Hub validation requirements
# Usage: ./manage-config.sh [get|set|list] [key] [value]

set -euo pipefail

CONFIG_FILE="config/policy-hub-config.json"
ACTION="${1:-list}"
KEY="${2:-}"
VALUE="${3:-}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

validate_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        log_error "Invalid JSON in configuration file"
        exit 1
    fi
}

list_config() {
    validate_config
    
    echo "🔧 Current Policy Hub Validation Configuration:"
    echo ""
    
    echo "📁 Required Files:"
    jq -r '.validation.requiredFiles[]' "$CONFIG_FILE" | sed 's/^/   - /'
    echo ""
    
    echo "📂 Required Directories:"
    jq -r '.validation.requiredDirs[]' "$CONFIG_FILE" | sed 's/^/   - /'
    echo ""
    
    echo "📝 Required Documentation Files:"
    jq -r '.validation.requiredDocsFiles[]' "$CONFIG_FILE" | sed 's/^/   - /'
    echo ""
    
    echo "🏷️  Required Metadata Fields:"
    jq -r '.validation.requiredMetadataFields[]' "$CONFIG_FILE" | sed 's/^/   - /'
    echo ""
    
    echo "📁 Optional Directories:"
    jq -r '.validation.optionalDirs[]' "$CONFIG_FILE" | sed 's/^/   - /'
    echo ""
    
    echo "⚙️  Other Settings:"
    echo "   - Version Regex: $(jq -r '.validation.versionRegex' "$CONFIG_FILE")"
    echo "   - Max Policy Name Length: $(jq -r '.validation.maxPolicyNameLength' "$CONFIG_FILE")"
    echo "   - Strict Validation: $(jq -r '.validation.strictValidation' "$CONFIG_FILE")"
    echo ""
    
    echo "🔌 Allowed File Extensions:"
    jq -r '.validation.allowedFileExtensions[]' "$CONFIG_FILE" | sed 's/^/   - /'
}

get_config() {
    validate_config
    local key="$1"
    
    case "$key" in
        "requiredFiles"|"requiredDirs"|"requiredDocsFiles"|"requiredMetadataFields"|"optionalDirs"|"allowedFileExtensions")
            echo "Array values for validation.$key:"
            jq -r ".validation.$key[]" "$CONFIG_FILE" | sed 's/^/   - /'
            ;;
        "versionRegex"|"maxPolicyNameLength"|"strictValidation")
            echo "Value for validation.$key:"
            echo "   $(jq -r ".validation.$key" "$CONFIG_FILE")"
            ;;
        *)
            log_error "Unknown configuration key: $key"
            echo ""
            echo "Available keys:"
            echo "  Arrays: requiredFiles, requiredDirs, requiredDocsFiles, requiredMetadataFields, optionalDirs, allowedFileExtensions"
            echo "  Values: versionRegex, maxPolicyNameLength, strictValidation"
            exit 1
            ;;
    esac
}

set_config() {
    validate_config
    local key="$1"
    local value="$2"
    
    case "$key" in
        "requiredFiles"|"requiredDirs"|"requiredDocsFiles"|"requiredMetadataFields"|"optionalDirs"|"allowedFileExtensions")
            # For arrays, expect comma-separated values
            IFS=',' read -ra VALUES <<< "$value"
            local json_array="["
            for i in "${!VALUES[@]}"; do
                if [ $i -gt 0 ]; then
                    json_array+=","
                fi
                json_array+="\"${VALUES[$i]}\""
            done
            json_array+="]"
            
            jq ".validation.$key = $json_array" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
            log_success "Updated validation.$key to: $(echo "$json_array" | jq -r '.[]' | tr '\n' ', ' | sed 's/,$//')"
            ;;
        "versionRegex"|"maxPolicyNameLength")
            jq ".validation.$key = \"$value\"" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
            log_success "Updated validation.$key to: $value"
            ;;
        "strictValidation")
            if [[ "$value" =~ ^(true|false)$ ]]; then
                jq ".validation.$key = $value" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
                log_success "Updated validation.$key to: $value"
            else
                log_error "strictValidation must be 'true' or 'false'"
                exit 1
            fi
            ;;
        *)
            log_error "Unknown configuration key: $key"
            exit 1
            ;;
    esac
}

add_to_array() {
    validate_config
    local key="$1"
    local value="$2"
    
    case "$key" in
        "requiredFiles"|"requiredDirs"|"requiredDocsFiles"|"requiredMetadataFields"|"optionalDirs"|"allowedFileExtensions")
            jq ".validation.$key += [\"$value\"]" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
            log_success "Added '$value' to validation.$key"
            ;;
        *)
            log_error "Can only add to array configuration keys"
            exit 1
            ;;
    esac
}

remove_from_array() {
    validate_config
    local key="$1"
    local value="$2"
    
    case "$key" in
        "requiredFiles"|"requiredDirs"|"requiredDocsFiles"|"requiredMetadataFields"|"optionalDirs"|"allowedFileExtensions")
            jq ".validation.$key = (.validation.$key | map(select(. != \"$value\")))" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
            log_success "Removed '$value' from validation.$key"
            ;;
        *)
            log_error "Can only remove from array configuration keys"
            exit 1
            ;;
    esac
}

show_help() {
    echo "Policy Hub Configuration Manager"
    echo ""
    echo "Usage: $0 <action> [key] [value]"
    echo ""
    echo "Actions:"
    echo "  list                    - Show all configuration settings"
    echo "  get <key>              - Get specific configuration value"
    echo "  set <key> <value>      - Set configuration value"
    echo "  add <key> <value>      - Add value to array configuration"
    echo "  remove <key> <value>   - Remove value from array configuration"
    echo "  help                   - Show this help message"
    echo ""
    echo "Configuration Keys:"
    echo "  requiredFiles          - Files that must exist in policy directory"
    echo "  requiredDirs           - Directories that must exist in policy directory"  
    echo "  requiredDocsFiles      - Documentation files that must exist in docs/"
    echo "  requiredMetadataFields - Fields that must exist in metadata.json"
    echo "  optionalDirs           - Optional directories (warnings if missing)"
    echo "  allowedFileExtensions  - File extensions allowed in policies"
    echo "  versionRegex           - Regex pattern for version validation"
    echo "  maxPolicyNameLength    - Maximum length for policy names"
    echo "  strictValidation       - Enable/disable strict validation (true/false)"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 get requiredFiles"
    echo "  $0 set requiredDocsFiles 'overview.md,readme.md'"
    echo "  $0 add requiredMetadataFields 'author'"
    echo "  $0 remove optionalDirs 'assets'"
    echo "  $0 set strictValidation false"
}

main() {
    case "$ACTION" in
        "list")
            list_config
            ;;
        "get")
            if [ -z "$KEY" ]; then
                log_error "Key required for get action"
                show_help
                exit 1
            fi
            get_config "$KEY"
            ;;
        "set")
            if [ -z "$KEY" ] || [ -z "$VALUE" ]; then
                log_error "Key and value required for set action"
                show_help
                exit 1
            fi
            set_config "$KEY" "$VALUE"
            ;;
        "add")
            if [ -z "$KEY" ] || [ -z "$VALUE" ]; then
                log_error "Key and value required for add action"
                show_help
                exit 1
            fi
            add_to_array "$KEY" "$VALUE"
            ;;
        "remove")
            if [ -z "$KEY" ] || [ -z "$VALUE" ]; then
                log_error "Key and value required for remove action"
                show_help
                exit 1
            fi
            remove_from_array "$KEY" "$VALUE"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            log_error "Unknown action: $ACTION"
            show_help
            exit 1
            ;;
    esac
}

main "$@"