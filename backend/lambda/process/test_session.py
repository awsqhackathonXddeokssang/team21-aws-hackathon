#!/usr/bin/env python3
"""
Test script for Session Lambda function
"""

import json
import requests
from lambda_function import lambda_handler

def test_local_lambda():
    """Test Session Lambda locally"""
    event = {
        'pathParameters': {'id': 'sess_test_123'},
        'body': json.dumps({
            'userProfile': {
                'target': 'keto',
                'step': 101,
                'responses': {
                    '1': 'diabetes',
                    '2': '',
                    '3': 'beginner',
                    '100': '30000',
                    '101': '2'
                }
            }
        })
    }
    
    result = lambda_handler(event, None)
    print("Local Lambda Test:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("-" * 50)

def test_api_gateway():
    """Test API Gateway endpoint"""
    # API Gateway URL will be available after deployment
    api_url = "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/dev"
    
    test_data = {
        'userProfile': {
            'target': 'keto',
            'step': 101,
            'responses': {
                '1': 'diabetes',
                '2': '',
                '3': 'beginner',
                '100': '30000',
                '101': '2'
            }
        }
    }
    
    try:
        response = requests.post(
            f"{api_url}/session/sess_test_456/process",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print("API Gateway Test:")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        
    except Exception as e:
        print(f"API Gateway test failed: {e}")
        print("Please update the API_URL after deployment")

if __name__ == '__main__':
    print("Testing Session Lambda Function")
    print("=" * 50)
    
    test_local_lambda()
    test_api_gateway()
    
    print("Tests completed!")
