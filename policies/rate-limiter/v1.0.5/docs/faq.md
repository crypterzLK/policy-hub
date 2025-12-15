# FAQ

## How is the client identified?
Currently uses a placeholder IP. In production, extract from headers like X-Forwarded-For.

## Is this distributed?
No, this is a simple in-memory implementation. For distributed systems, use shared storage.

## What happens when limit is exceeded?
Returns HTTP 429 with a JSON error message.