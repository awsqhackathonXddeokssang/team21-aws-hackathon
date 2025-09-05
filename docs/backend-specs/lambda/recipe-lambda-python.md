# Recipe Lambda Python 구현

## 개요
AWS Bedrock Claude 3을 활용한 Python 기반 Recipe Lambda 함수 구현

## 파일 구조
```
backend/lambda/recipe/
├── lambda_function.py      # 메인 핸들러
├── requirements.txt        # Python 의존성
├── prompts/
│   ├── __init__.py
│   ├── keto.py            # 케토 다이어트 프롬프트
│   ├── baby_food.py       # 이유식 프롬프트
│   ├── diabetes.py        # 당뇨 관리 프롬프트
│   ├── diet.py            # 일반 다이어트 프롬프트
│   └── fridge.py          # 냉장고 털기 프롬프트
├── utils/
│   ├── __init__.py
│   ├── bedrock_client.py  # Bedrock 클라이언트
│   ├── nutrition_rag.py   # 영양소 RAG 시스템
│   └── validators.py      # 입력 검증
└── models/
    ├── __init__.py
    └── recipe_models.py   # 데이터 모델
```

## 메인 핸들러 (lambda_function.py)
```python
import json
import logging
import os
from typing import Dict, Any
from utils.bedrock_client import BedrockClient
from utils.nutrition_rag import NutritionRAG
from utils.validators import validate_input
from prompts import get_prompt_by_target
from models.recipe_models import RecipeResult

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Recipe Lambda 메인 핸들러"""
    try:
        # 입력 검증
        validate_input(event)
        
        session_id = event['sessionId']
        profile = event['profile']
        target = profile['target']
        
        logger.info(f"Processing recipe generation for session: {session_id}, target: {target}")
        
        # Bedrock 클라이언트 초기화
        bedrock_client = BedrockClient()
        
        # 타겟별 프롬프트 생성
        prompt = get_prompt_by_target(target, profile)
        
        # AI 레시피 생성
        recipe_response = bedrock_client.generate_recipe(prompt)
        
        # 영양소 정보 조회
        nutrition_rag = NutritionRAG()
        nutrition_info = nutrition_rag.get_nutrition_info(recipe_response['ingredients'])
        
        # 결과 합성
        result = RecipeResult(
            recipe=recipe_response,
            nutrition=nutrition_info,
            target_compliance=calculate_target_compliance(recipe_response, nutrition_info, target)
        )
        
        return {
            'statusCode': 200,
            'body': result.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Error processing recipe generation: {str(e)}")
        return {
            'statusCode': 500,
            'body': {
                'error': 'Recipe generation failed',
                'message': str(e)
            }
        }

def calculate_target_compliance(recipe: Dict, nutrition: Dict, target: str) -> Dict:
    """타겟별 준수도 계산"""
    compliance_calculators = {
        'keto': calculate_keto_compliance,
        'baby_food': calculate_baby_food_compliance,
        'diabetes': calculate_diabetes_compliance,
        'diet': calculate_diet_compliance,
        'fridge': calculate_fridge_compliance
    }
    
    calculator = compliance_calculators.get(target, lambda r, n: {'compliance': 100})
    return calculator(recipe, nutrition)

def calculate_keto_compliance(recipe: Dict, nutrition: Dict) -> Dict:
    """케토 다이어트 준수도 계산"""
    total_calories = nutrition['total']['calories']
    fat_calories = nutrition['total']['fat'] * 9
    protein_calories = nutrition['total']['protein'] * 4
    carb_calories = nutrition['total']['carbs'] * 4
    
    fat_ratio = (fat_calories / total_calories) * 100
    protein_ratio = (protein_calories / total_calories) * 100
    carb_ratio = (carb_calories / total_calories) * 100
    
    # 케토 기준: 지방 70%+, 단백질 25%, 탄수화물 5% 이하
    compliance = 100
    if fat_ratio < 70:
        compliance -= (70 - fat_ratio) * 2
    if carb_ratio > 5:
        compliance -= (carb_ratio - 5) * 10
    
    return {
        'compliance': max(0, compliance),
        'fat_ratio': round(fat_ratio, 1),
        'protein_ratio': round(protein_ratio, 1),
        'carb_ratio': round(carb_ratio, 1),
        'notes': f"케토 매크로 비율 - 지방: {fat_ratio:.1f}%, 단백질: {protein_ratio:.1f}%, 탄수화물: {carb_ratio:.1f}%"
    }
```

## Bedrock 클라이언트 (utils/bedrock_client.py)
```python
import boto3
import json
import logging
from typing import Dict, Any
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class BedrockClient:
    def __init__(self):
        self.client = boto3.client('bedrock-runtime', region_name=os.environ.get('BEDROCK_REGION', 'us-east-1'))
        self.model_id = 'anthropic.claude-3-sonnet-20240229-v1:0'
    
    def generate_recipe(self, prompt: str, max_retries: int = 3) -> Dict[str, Any]:
        """Bedrock을 사용하여 레시피 생성"""
        for attempt in range(max_retries):
            try:
                body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 4000,
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                }
                
                response = self.client.invoke_model(
                    modelId=self.model_id,
                    body=json.dumps(body)
                )
                
                response_body = json.loads(response['body'].read())
                content = response_body['content'][0]['text']
                
                # JSON 응답 파싱
                recipe_data = json.loads(content)
                return recipe_data
                
            except ClientError as e:
                if e.response['Error']['Code'] == 'ThrottlingException' and attempt < max_retries - 1:
                    import time
                    time.sleep(2 ** attempt)  # 지수 백오프
                    continue
                else:
                    logger.error(f"Bedrock API error: {e}")
                    raise
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse recipe JSON: {e}")
                if attempt < max_retries - 1:
                    continue
                else:
                    raise
            except Exception as e:
                logger.error(f"Unexpected error in recipe generation: {e}")
                raise
        
        # 모든 재시도 실패 시 기본 레시피 반환
        return self._get_default_recipe()
    
    def _get_default_recipe(self) -> Dict[str, Any]:
        """기본 레시피 반환"""
        return {
            "recipeName": "간단한 샐러드",
            "description": "기본 건강 샐러드",
            "cookingTime": 10,
            "difficulty": "easy",
            "servings": 1,
            "ingredients": [
                {"name": "양상추", "amount": "100", "unit": "g"},
                {"name": "토마토", "amount": "1", "unit": "개"},
                {"name": "올리브오일", "amount": "1", "unit": "큰술"}
            ],
            "instructions": [
                "1. 양상추를 깨끗이 씻어 준비합니다.",
                "2. 토마토를 적당한 크기로 자릅니다.",
                "3. 올리브오일을 뿌려 완성합니다."
            ]
        }
```

## 영양소 RAG 시스템 (utils/nutrition_rag.py)
```python
import boto3
import json
import logging
from typing import List, Dict, Any
from opensearchpy import OpenSearch, RequestsHttpConnection
from aws_requests_auth.aws_auth import AWSRequestsAuth

logger = logging.getLogger(__name__)

class NutritionRAG:
    def __init__(self):
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=os.environ.get('BEDROCK_REGION', 'us-east-1'))
        self.opensearch_client = self._init_opensearch()
        self.embedding_model = 'amazon.titan-embed-text-v1'
    
    def _init_opensearch(self) -> OpenSearch:
        """OpenSearch 클라이언트 초기화"""
        host = os.environ.get('OPENSEARCH_ENDPOINT', '').replace('https://', '')
        region = os.environ.get('AWS_REGION', 'us-east-1')
        
        awsauth = AWSRequestsAuth(
            aws_access_key=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
            aws_token=os.environ.get('AWS_SESSION_TOKEN'),
            aws_host=host,
            aws_region=region,
            aws_service='es'
        )
        
        return OpenSearch(
            hosts=[{'host': host, 'port': 443}],
            http_auth=awsauth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection
        )
    
    def get_nutrition_info(self, ingredients: List[Dict[str, str]]) -> Dict[str, Any]:
        """재료 목록의 영양소 정보 조회"""
        nutrition_results = []
        
        for ingredient in ingredients:
            nutrition_data = self._search_ingredient_nutrition(ingredient['name'])
            calculated_nutrition = self._calculate_nutrition_by_amount(
                nutrition_data, 
                float(ingredient['amount']), 
                ingredient['unit']
            )
            nutrition_results.append(calculated_nutrition)
        
        total_nutrition = self._sum_nutrition(nutrition_results)
        per_serving_nutrition = self._calculate_per_serving(total_nutrition, 2)  # 기본 2인분
        
        return {
            'total': total_nutrition,
            'perServing': per_serving_nutrition,
            'ingredients': nutrition_results
        }
    
    def _search_ingredient_nutrition(self, ingredient_name: str) -> Dict[str, Any]:
        """재료명으로 영양소 정보 검색"""
        try:
            # 1. 정확한 매칭 시도
            exact_query = {
                "query": {
                    "term": {
                        "ingredient_name_keyword": ingredient_name
                    }
                }
            }
            
            response = self.opensearch_client.search(
                index='ingredient-nutrition',
                body=exact_query
            )
            
            if response['hits']['total']['value'] > 0:
                return response['hits']['hits'][0]['_source']
            
            # 2. 임베딩 기반 유사도 검색
            embedding = self._get_embedding(ingredient_name)
            
            knn_query = {
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": embedding,
                            "k": 1
                        }
                    }
                }
            }
            
            response = self.opensearch_client.search(
                index='ingredient-nutrition',
                body=knn_query
            )
            
            if response['hits']['total']['value'] > 0:
                return response['hits']['hits'][0]['_source']
            
        except Exception as e:
            logger.warning(f"Failed to search nutrition for {ingredient_name}: {e}")
        
        # 기본값 반환
        return self._get_default_nutrition(ingredient_name)
    
    def _get_embedding(self, text: str) -> List[float]:
        """텍스트 임베딩 생성"""
        try:
            body = {
                "inputText": text
            }
            
            response = self.bedrock_client.invoke_model(
                modelId=self.embedding_model,
                body=json.dumps(body)
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return [0.0] * 1536  # Titan 임베딩 차원
    
    def _calculate_nutrition_by_amount(self, nutrition_data: Dict, amount: float, unit: str) -> Dict:
        """양에 따른 영양소 계산"""
        # 단위 변환 (모든 것을 100g 기준으로 정규화)
        conversion_factor = self._get_conversion_factor(amount, unit)
        
        return {
            'ingredient': nutrition_data.get('ingredient_name', ''),
            'amount': f"{amount}{unit}",
            'calories': round(nutrition_data.get('calories_per_100g', 0) * conversion_factor, 1),
            'protein': round(nutrition_data.get('protein', 0) * conversion_factor, 1),
            'fat': round(nutrition_data.get('fat', 0) * conversion_factor, 1),
            'carbs': round(nutrition_data.get('carbs', 0) * conversion_factor, 1),
            'fiber': round(nutrition_data.get('fiber', 0) * conversion_factor, 1),
            'sodium': round(nutrition_data.get('sodium', 0) * conversion_factor, 1)
        }
    
    def _get_conversion_factor(self, amount: float, unit: str) -> float:
        """단위별 변환 계수"""
        unit_conversions = {
            'g': amount / 100,
            'kg': amount * 10,
            '개': amount * 1.5,  # 평균적인 개당 무게 추정
            '큰술': amount * 0.15,
            '작은술': amount * 0.05,
            '컵': amount * 2.0
        }
        return unit_conversions.get(unit, amount / 100)
    
    def _sum_nutrition(self, nutrition_list: List[Dict]) -> Dict:
        """영양소 합계 계산"""
        total = {
            'calories': 0, 'protein': 0, 'fat': 0, 
            'carbs': 0, 'fiber': 0, 'sodium': 0
        }
        
        for nutrition in nutrition_list:
            for key in total.keys():
                total[key] += nutrition.get(key, 0)
        
        return {k: round(v, 1) for k, v in total.items()}
    
    def _calculate_per_serving(self, total_nutrition: Dict, servings: int) -> Dict:
        """1인분당 영양소 계산"""
        return {k: round(v / servings, 1) for k, v in total_nutrition.items()}
    
    def _get_default_nutrition(self, ingredient_name: str) -> Dict:
        """기본 영양소 정보"""
        return {
            'ingredient_name': ingredient_name,
            'calories_per_100g': 50,
            'protein': 2.0,
            'fat': 0.5,
            'carbs': 10.0,
            'fiber': 2.0,
            'sodium': 5
        }
```

## 프롬프트 모듈 (prompts/__init__.py)
```python
from .keto import KETO_PROMPT
from .baby_food import BABY_FOOD_PROMPT
from .diabetes import DIABETES_PROMPT
from .diet import DIET_PROMPT
from .fridge import FRIDGE_PROMPT

def get_prompt_by_target(target: str, profile: dict) -> str:
    """타겟별 프롬프트 반환"""
    prompt_map = {
        'keto': KETO_PROMPT,
        'baby_food': BABY_FOOD_PROMPT,
        'diabetes': DIABETES_PROMPT,
        'diet': DIET_PROMPT,
        'fridge': FRIDGE_PROMPT
    }
    
    prompt_template = prompt_map.get(target, DIET_PROMPT)
    return prompt_template.format(**profile)
```

## 케토 프롬프트 (prompts/keto.py)
```python
KETO_PROMPT = """
당신은 케토제닉 다이어트 전문 영양사입니다. 다음 조건에 맞는 레시피를 생성해주세요:

사용자 프로필:
- 건강 상태: {healthConditions}
- 알레르기: {allergies}
- 요리 실력: {cookingLevel}
- 예산: {budget}원
- 선호 음식: {preferences}

케토 다이어트 요구사항:
- 탄수화물: 5g 이하 (총 칼로리의 5% 이하)
- 지방: 70% 이상
- 단백질: 20-25%
- 총 칼로리: {maxCalories}kcal 이하

다음 JSON 형식으로 정확히 응답해주세요:
{{
  "recipeName": "레시피명",
  "description": "레시피 설명",
  "cookingTime": 25,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {{"name": "아보카도", "amount": "1", "unit": "개"}},
    {{"name": "올리브오일", "amount": "2", "unit": "큰술"}}
  ],
  "instructions": [
    "1. 아보카도를 반으로 자릅니다.",
    "2. 올리브오일을 뿌립니다."
  ],
  "nutritionTips": "케토 다이어트에 완벽한 고지방 저탄수화물 레시피입니다.",
  "ketoNotes": "케토시스 유지에 도움되는 MCT 오일 추가를 권장합니다."
}}
"""
```

## 데이터 모델 (models/recipe_models.py)
```python
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
from datetime import datetime

@dataclass
class Ingredient:
    name: str
    amount: str
    unit: str

@dataclass
class Recipe:
    name: str
    description: str
    cooking_time: int
    difficulty: str
    servings: int
    ingredients: List[Ingredient]
    instructions: List[str]

@dataclass
class Nutrition:
    total: Dict[str, float]
    per_serving: Dict[str, float]
    macro_ratio: Dict[str, float]

@dataclass
class TargetCompliance:
    target: str
    compliance: float
    notes: str
    recommendations: List[str]

@dataclass
class RecipeResult:
    recipe: Recipe
    nutrition: Nutrition
    target_compliance: TargetCompliance
    generated_at: str = None
    
    def __post_init__(self):
        if self.generated_at is None:
            self.generated_at = datetime.utcnow().isoformat() + 'Z'
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
```

## 의존성 (requirements.txt)
```
boto3>=1.34.0
opensearch-py>=2.4.0
aws-requests-auth>=0.4.3
```

## 환경변수
```bash
BEDROCK_REGION=us-east-1
OPENSEARCH_ENDPOINT=https://search-nutrition-xxx.us-east-1.es.amazonaws.com
AWS_REGION=us-east-1
```
