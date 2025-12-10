# Sample Policy Documentation

## Overview

The Sample Policy is a demonstration policy that shows how to structure policies in the Policy Hub repository. It implements basic authentication-based access control.

## Features

- **Authentication Check**: Validates user authentication status
- **Block List Check**: Prevents access from blocked users
- **Risk Assessment**: Evaluates risk scores for suspicious activity
- **Comprehensive Logging**: Logs all policy decisions

## Usage

### Basic Usage

```go
policy := &SamplePolicy{
    Name: "sample-policy",
    Version: "v1.0.0",
}

request := map[string]interface{}{
    "authenticated": true,
    "blocked": false,
    "suspicious": false,
    "risk_score": 0.3,
}

if policy.Evaluate(request) {
    // Grant access
    fmt.Println("Access granted")
}
```

### Configuration

The policy can be configured through the `policy-definition.yaml` file:

```yaml
spec:
  parameters:
    risk_threshold: 0.8    # Adjust risk sensitivity
    enable_alerts: true    # Enable/disable alerting
```

## Rules

### 1. authenticated-access
- **Priority**: 100
- **Condition**: User is authenticated AND not blocked
- **Action**: Allow access

### 2. block-suspicious
- **Priority**: 200
- **Condition**: User is suspicious OR risk score > threshold
- **Action**: Deny access with alert

### 3. default-deny
- **Priority**: 999
- **Condition**: Always true (catch-all)
- **Action**: Deny access

## Metrics

The policy collects the following metrics:
- Policy evaluation count
- Access granted/denied counts
- Average evaluation time
- Error rate

## Troubleshooting

### Common Issues

1. **Access unexpectedly denied**
   - Check user authentication status
   - Verify user is not on block list
   - Review risk score calculation

2. **High false positive rate**
   - Adjust `risk_threshold` parameter
   - Review risk scoring algorithm
   - Check for data quality issues

### Debug Mode

Enable debug logging by setting the policy log level to `debug` in the configuration.

## Contributing

To contribute improvements to this sample policy:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This sample policy is licensed under the MIT License.