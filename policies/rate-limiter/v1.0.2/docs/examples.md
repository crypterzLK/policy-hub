# Examples

## Example 1: Basic Rate Limiting
Limit to 60 requests per minute with 10 burst.

Configuration:
```yaml
parameters:
  requestsPerMinute: 60
  burstLimit: 10
```

## Example 2: Strict Limiting
Low limit for sensitive endpoints.

Configuration:
```yaml
parameters:
  requestsPerMinute: 10
  burstLimit: 2
```