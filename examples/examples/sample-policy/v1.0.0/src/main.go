package src
package main

import (
	"fmt"
	"log"
)

// SamplePolicy implements a basic network access policy
type SamplePolicy struct {
	Name        string
	Version     string
	Description string
}

// Evaluate checks if the request should be allowed
func (p *SamplePolicy) Evaluate(request map[string]interface{}) bool {
	// Sample logic: allow if user is authenticated and not blocked
	if auth, ok := request["authenticated"].(bool); ok && auth {
		if blocked, ok := request["blocked"].(bool); ok && !blocked {
			return true
		}
	}
	return false
}

func main() {
	policy := &SamplePolicy{
		Name:        "sample-policy",
		Version:     "v1.0.0",
		Description: "Sample policy for demonstration",
	}

	// Test the policy
	testRequest := map[string]interface{}{










}	}		log.Println("Policy evaluation failed")		fmt.Println("❌ Access denied")	} else {		fmt.Println("✅ Access granted")	if policy.Evaluate(testRequest) {	}		"blocked":       false,		"authenticated": true,