import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
sessions_table = dynamodb.Table('ai-chef-sessions')

def lambda_handler(event, context):
    try:
        session_id = event.get('sessionId')
        recipe_result = event.get('recipeResult')
        pricing_result = event.get('pricingResult')
        profile = event.get('profile')
        
        if not session_id or not recipe_result or not pricing_result:
            raise ValueError('sessionId, recipeResult, and pricingResult required')
        
        # 레시피와 가격 데이터 결합
        total_cost = pricing_result.get('recommendations', {}).get('totalEstimatedCost', 0)
        
        result = {
            'success': True,
            'data': {
                'sessionId': session_id,
                'recipe': {
                    'name': recipe_result.get('name', recipe_result.get('recipeName', '')),
                    'ingredients': recipe_result.get('ingredients', []),
                    'instructions': recipe_result.get('instructions', []),
                    'cookingTime': recipe_result.get('cookingTime', ''),
                    'difficulty': recipe_result.get('difficulty', 'medium'),
                    'servings': recipe_result.get('servings', 2)
                },
                'nutrition': {
                    'total': recipe_result.get('nutrition', {}),
                    'targetCompliance': recipe_result.get('targetCompliance', {})
                },
                'pricing': pricing_result,
                'totalEstimatedCost': total_cost,
                'generatedAt': datetime.now().isoformat(),
                'profile': profile,
                'summary': {
                    'recipeAvailable': bool(recipe_result.get('name') or recipe_result.get('recipeName')),
                    'pricingAvailable': pricing_result.get('summary', {}).get('foundIngredients', 0) > 0,
                    'nutritionAvailable': bool(recipe_result.get('nutrition')),
                    'successRate': pricing_result.get('summary', {}).get('successRate', 0)
                }
            },
            'metadata': {
                'source': 'CombineLambda',
                'timestamp': datetime.now().isoformat(),
                'version': '2.0'
            }
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': result
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': {'success': False, 'error': str(e)}
        }
