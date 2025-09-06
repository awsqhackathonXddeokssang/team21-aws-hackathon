import json
from lambda_function import lambda_handler

def test_price_lookup():
    """Price Lambda 테스트"""
    event = {
        'sessionId': 'test_session_123',
        'ingredients': ['새우', '양파', '마늘']
    }
    
    context = type('Context', (), {
        'aws_request_id': 'test-request-id',
        'function_name': 'PriceLambda',
        'memory_limit_in_mb': 256,
        'remaining_time_in_millis': lambda: 30000
    })()
    
    result = lambda_handler(event, context)
    print("=== Price Lambda Test Result ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result

def test_price_lookup_with_objects():
    """객체 형태 재료로 테스트"""
    event = {
        'sessionId': 'test_session_456',
        'ingredients': [
            {'name': '새우', 'amount': '200g'},
            {'name': '양파', 'amount': '1개'},
            {'name': '마늘', 'amount': '3쪽'}
        ]
    }
    
    context = type('Context', (), {
        'aws_request_id': 'test-request-id-2'
    })()
    
    result = lambda_handler(event, context)
    print("=== Price Lambda Object Test Result ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result

if __name__ == '__main__':
    # 기본 테스트
    test_price_lookup()
    
    print("\n" + "="*50 + "\n")
    
    # 객체 형태 테스트
    test_price_lookup_with_objects()
