# FAQ

## Can I modify existing headers?
Yes, if the header already exists, its value will be overwritten with the new value.

## Does this policy work on response headers?
No, this policy only affects request headers.

## What happens if the header name is invalid?
The policy will still attempt to set the header, but it may be rejected by the HTTP protocol if it contains invalid characters.