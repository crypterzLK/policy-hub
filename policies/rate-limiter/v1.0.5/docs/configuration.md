# Configuration

## Parameters

- **requestsPerMinute** (integer, required): Maximum number of requests allowed per minute.
- **burstLimit** (integer, required): Additional burst capacity for handling spikes.

## Example Configuration
```yaml
parameters:
  requestsPerMinute: 100
  burstLimit: 20
```