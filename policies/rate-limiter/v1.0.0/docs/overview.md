# Rate Limiting Policy Overview

The Rate Limiting Policy enforces API rate limits to prevent abuse and ensure fair usage. It limits the number of requests per minute and supports burst handling.

## Use Cases
- Protect APIs from DDoS attacks
- Enforce usage quotas for different user tiers
- Control traffic spikes

## How It Works
The policy tracks request counts per client (e.g., by IP) and blocks requests exceeding the configured limits by returning a 429 status code.