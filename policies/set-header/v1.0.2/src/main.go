package set_header

import (
	"errors"
)

// Define policy types locally to avoid external dependency

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
	// Placeholder for body
}

type RequestAction interface{}

type ResponseAction interface{}

type UpstreamRequestModifications struct{}

type UpstreamResponseModifications struct{}

type SetHeaderPolicy struct{}

// Validate configuration parameters
func (s *SetHeaderPolicy) Validate(params map[string]interface{}) error {
	if _, ok := params["headerName"].(string); !ok {
		return errors.New("headerName is required and must be a string")
	}
	if _, ok := params["headerValue"].(string); !ok {
		return errors.New("headerValue is required and must be a string")
	}
	return nil
}

// Declare processing behavior
func (s *SetHeaderPolicy) Mode() ProcessingMode {
	return ProcessingMode{
		RequestHeaderMode:  HeaderModeProcess,
		ResponseHeaderMode: HeaderModeSkip,
		RequestBodyMode:    BodyModeSkip,
		ResponseBodyMode:   BodyModeSkip,
	}
}

// Request phase execution
func (s *SetHeaderPolicy) OnRequest(ctx *RequestContext, params map[string]interface{}) RequestAction {
	headerName := params["headerName"].(string)
	headerValue := params["headerValue"].(string)
	ctx.Headers[headerName] = []string{headerValue}
	return UpstreamRequestModifications{}
}

// Response phase (not used)
func (s *SetHeaderPolicy) OnResponse(ctx *ResponseContext, params map[string]interface{}) ResponseAction {
	return UpstreamResponseModifications{}
}
