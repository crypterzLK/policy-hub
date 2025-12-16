# State Management Directory

This directory tracks the delivery state of policies to ensure reliable, idempotent releases.

## Files

### baseline.sha
Stores the earliest commit SHA from which changes must be considered.
- First release: defaults to repository root commit
- Subsequent releases: used to compute change delta

### delivered.json
Tracks successful delivery per policy folder.

Example:
```json
{
  "policies/rate-limiter/v1.0.0": {
    "sha": "acde1234567890",
    "deliveredAt": "2025-12-16T10:30:00Z",
    "release": "v1.2.0"
  }
}
```

## How It Works

1. **Detection**: Compare HEAD against baseline.sha to find changed policy folders
2. **Eligibility**: Check delivered.json to determine if folder needs delivery
3. **Delivery**: Publish policy to external API
4. **Update**: Record successful delivery in delivered.json with commit SHA
5. **Retry**: Failed deliveries are automatically retried on next release

## Benefits

- **Granular reliability**: Per-folder tracking
- **Failure-safe**: Auto-retry on failure
- **Idempotent**: Safe to run multiple times
- **Auditable**: Git-tracked state
