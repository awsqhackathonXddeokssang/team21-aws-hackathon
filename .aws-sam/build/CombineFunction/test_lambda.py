import json
from lambda_function import lambda_handler

def test_combine():
    """Combine Lambda 테스트 - Step Functions 형식"""
    event = {
        'sessionId': 'test_session_123',
        'profile': {'target': 'keto', 'cookingLevel': 'beginner'},
        'recipeResult': {
            'name': '케토 아보카도 샐러드',
            'ingredients': [
                {'name': '아보카도', 'amount': '2개'},
                {'name': '올리브오일', 'amount': '2큰술'}
            ],
            'instructions': ['아보카도를 썰어주세요', '올리브오일과 섞어주세요'],
            'cookingTime': '10분',
            'nutrition': {'calories': 350, 'protein': 4, 'fat': 32, 'carbs': 8},
            'targetCompliance': {'keto': True}
        },
        'pricingResult': {
            'summary': {
                'totalIngredients': 2,
                'foundIngredients': 2,
                'successRate': 1.0
            },
            'ingredients': {
                '아보카도': [
                    {'name': '신선한 아보카도', 'price': 3500, 'vendor': '마트A'},
                    {'name': '유기농 아보카도', 'price': 4000, 'vendor': '마트B'}
                ],
                '올리브오일': [
                    {'name': '엑스트라버진 올리브오일', 'price': 8000, 'vendor': '마트A'}
                ]
            },
            'recommendations': {
                'totalEstimatedCost': 11500,
                'optimalVendors': [
                    {
                        'vendor': '마트A',
                        'items': [
                            {'ingredient': '아보카도', 'price': 3500},
                            {'ingredient': '올리브오일', 'price': 8000}
                        ],
                        'totalPrice': 11500,
                        'itemCount': 2
                    }
                ]
            }
        }
    }
    
    context = type('Context', (), {
        'aws_request_id': 'test-request-id',
        'function_name': 'CombineLambda'
    })()
    
    result = lambda_handler(event, context)
    print("=== Combine Lambda Test Result ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result

def test_combine_error():
    """에러 케이스 테스트"""
    event = {
        'sessionId': 'test_session_error'
        # recipeResult와 pricingResult 누락
    }
    
    result = lambda_handler(event, {})
    print("=== Combine Lambda Error Test Result ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result

if __name__ == '__main__':
    # 정상 케이스 테스트
    test_combine()
    
    print("\n" + "="*50 + "\n")
    
    # 에러 케이스 테스트
    test_combine_error()
