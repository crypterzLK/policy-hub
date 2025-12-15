package main

import (
	"errors"
	"time"
)

// Define policy types locally

type HeaderProcessingMode string

const (
	HeaderModeSkip    HeaderProcessingMode = "SKIP"
	HeaderModeProcess HeaderProcessingMode = "PROCESS"
)

type BodyProcessingMode string

const (
	BodyModeSkip   BodyProcessingMode = "SKIP"
	BodyModeBuffer BodyProcessingMode = "BUFFER"
	BodyModeStream BodyProcessingMode = "STREAM"
)

type ProcessingMode struct {
	RequestHeaderMode  HeaderProcessingMode
	RequestBodyMode    BodyProcessingMode
	ResponseHeaderMode HeaderProcessingMode
	ResponseBodyMode   BodyProcessingMode
}

type RequestContext struct {
	Headers map[string][]string
	Body    *Body
	Path    string
	Method  string
	// SharedContext would be here
}

type ResponseContext struct {
	ResponseHeaders map[string][]string
	ResponseBody    *Body
	ResponseStatus  int
	// SharedContext would be here
}

type Body struct {
	// Placeholder
}

type RequestAction interface{}

type ResponseAction interface{}

type UpstreamRequestModifications struct{}

type UpstreamResponseModifications struct{}

type ImmediateResponse struct {
	Status  int
	Headers map[string][]string
	Body    string
}

type RateLimiterPolicy struct {
	// Simple in-memory rate limiting (not suitable for production)
	requestCounts map[string]int
	lastReset     time.Time
}

// Validate configuration parameters
func (r *RateLimiterPolicy) Validate(params map[string]interface{}) error {
	if _, ok := params["requestsPerMinute"].(float64); !ok {
		return errors.New("requestsPerMinute is required and must be an integer")
	}
	if _, ok := params["burstLimit"].(float64); !ok {
		return errors.New("burstLimit is required and must be an integer")
	}
	return nil
}

// Declare processing behavior
func (r *RateLimiterPolicy) Mode() ProcessingMode {
	return ProcessingMode{
		RequestHeaderMode:  HeaderModeProcess,
		ResponseHeaderMode: HeaderModeSkip,
		RequestBodyMode:    BodyModeSkip,
		ResponseBodyMode:   BodyModeSkip,
	}
}

// Request phase execution
func (r *RateLimiterPolicy) OnRequest(ctx *RequestContext, params map[string]interface{}) RequestAction {
	rpm := int(params["requestsPerMinute"].(float64))
	burst := int(params["burstLimit"].(float64))

	// Simple rate limiting logic (use client IP or something)
	clientIP := "127.0.0.1" // Placeholder, in real use get from headers
	if r.requestCounts == nil {
		r.requestCounts = make(map[string]int)
	}

	// Reset counts every minute
	now := time.Now()
	if now.Sub(r.lastReset) > time.Minute {
		r.requestCounts = make(map[string]int)
		r.lastReset = now
	}

	count := r.requestCounts[clientIP]
	if count >= rpm+burst {
		// Rate limit exceeded
		return ImmediateResponse{
			Status: 429,
			Headers: map[string][]string{
				"Content-Type": {"application/json"},
			},
			Body: `{"error": "Rate limit exceeded"}`,
		}
	}

	r.requestCounts[clientIP] = count + 1
	return UpstreamRequestModifications{}
}

// Response phase (not used)
func (r *RateLimiterPolicy) OnResponse(ctx *ResponseContext, params map[string]interface{}) ResponseAction {
	return UpstreamResponseModifications{}
}
