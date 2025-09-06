#!/usr/bin/env python3
"""
Test script for Recipe Lambda function
"""

import json
from lambda_function import lambda_handler

def test_keto_recipe():
    """Test keto recipe generation"""
    event = {
        'sessionId': 'test-keto-123',
        'profile': {
            'target': 'keto',
            'healthConditions': ['diabetes'],
            'allergies': [],
            'cookingLevel': 'beginner',
            'budget': 30000
        }
    }
    
    result = lambda_handler(event, None)
    print("Keto Recipe Test:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("-" * 50)

def test_general_recipe():
    """Test general recipe generation"""
    event = {
        'sessionId': 'test-general-456',
        'profile': {
            'target': 'general',
            'healthConditions': [],
            'allergies': ['nuts'],
            'cookingLevel': 'intermediate',
            'budget': 20000
        }
    }
    
    result = lambda_handler(event, None)
    print("General Recipe Test:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("-" * 50)

def test_error_handling():
    """Test error handling with invalid input"""
    event = {
        'sessionId': 'test-error-789',
        'profile': {}  # Empty profile to trigger error handling
    }
    
    result = lambda_handler(event, None)
    print("Error Handling Test:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("-" * 50)

if __name__ == '__main__':
    print("Testing Recipe Lambda Function")
    print("=" * 50)
    
    test_keto_recipe()
    test_general_recipe()
    test_error_handling()
    
    print("All tests completed!")
