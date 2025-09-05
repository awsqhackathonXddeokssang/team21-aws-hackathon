# Bedrock 연동 구현 가이드 (업데이트됨)

## 개요
AWS Bedrock Claude Opus 4.1을 활용한 AI 레시피 생성 시스템 구현
**Python 3.11 기반, 타겟별 맞춤 프롬프트 엔지니어링**

## Bedrock 모델 설정 (업데이트됨)

### 지원 모델
```python
BEDROCK_MODELS = {
    'claude-opus-4.1': 'anthropic.claude-opus-4-1-20250805-v1:0',  # 메인 모델
    'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
    'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
    'titan-embed': 'amazon.titan-embed-text-v1'
}
```

### 모델별 특성 (업데이트됨)
- **Claude Opus 4.1**: 최고 성능, 복잡한 레시피 생성 및 영양 분석
- **Claude 3 Sonnet**: 균형잡힌 성능, 백업 모델
- **Claude 3 Haiku**: 빠른 응답, 간단한 요청용
- **Titan Embeddings**: 영양소 RAG 검색용

## Recipe Lambda 통합 구현

### 메인 Bedrock 클라이언트 (Python)
```python
import boto3
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class BedrockClient:
    def __init__(self, region='us-east-1'):
        self.bedrock = boto3.client('bedrock-runtime', region_name=region)
        self.model_id = 'anthropic.claude-opus-4-1-20250805-v1:0'
    
    def generate_recipe(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Claude Opus 4.1을 사용한 레시피 생성"""
        try:
            prompt = self.build_target_specific_prompt(profile)
            
            response = self.bedrock.invoke_model(
                modelId=self.model_id,
                body=json.dumps({
                    'anthropic_version': 'bedrock-2023-05-31',
                    'max_tokens': 4000,
                    'temperature': 0.7,
                    'messages': [{'role': 'user', 'content': prompt}]
                })
            )
            
            result = json.loads(response['body'].read())
            recipe_text = result['content'][0]['text']
            
            return self.extract_json_from_text(recipe_text)
            
        except Exception as e:
            logger.error(f'Bedrock API error: {str(e)}')
            return self.get_fallback_recipe(profile.get('target', 'general'))
    
    def build_target_specific_prompt(self, profile: Dict[str, Any]) -> str:
        """타겟별 맞춤 프롬프트 생성"""
        target = profile.get('target', 'general')
        
        if target == 'keto':
            return self.build_keto_prompt(profile)
        elif target == 'baby_food':
            return self.build_baby_food_prompt(profile)
        elif target == 'diabetes':
            return self.build_diabetes_prompt(profile)
        elif target == 'diet':
            return self.build_diet_prompt(profile)
        elif target == 'fridge':
            return self.build_fridge_clearing_prompt(profile)
        else:
            return self.build_general_prompt(profile)
```

### 타겟별 프롬프트 엔지니어링

#### 1. 케토 다이어트 프롬프트
```python
def build_keto_prompt(self, profile: Dict[str, Any]) -> str:
    """케토제닉 다이어트 전문 프롬프트"""
    health_conditions = ', '.join(profile.get('healthConditions', [])) or '없음'
    allergies = ', '.join(profile.get('allergies', [])) or '없음'
    cooking_level = profile.get('cookingLevel', '초급')
    budget = profile.get('budget', 30000)
    
    return f"""당신은 케토제닉 다이어트 전문 영양사입니다. 다음 조건에 맞는 레시피를 생성해주세요:

사용자 프로필:
- 건강 상태: {health_conditions}
- 알레르기: {allergies}
- 요리 실력: {cooking_level}
- 예산: {budget}원

케토 다이어트 요구사항:
- 탄수화물: 5g 이하
- 지방: 70% 이상
- 단백질: 25% 내외
- 총 칼로리: 600kcal 이하

JSON 형식으로 응답:
{{
  "recipeName": "케토 아보카도 샐러드",
  "description": "고지방 저탄수화물 케토 다이어트 샐러드",
  "cookingTime": 15,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {{"name": "아보카도", "amount": "2", "unit": "개"}},
    {{"name": "올리브오일", "amount": "3", "unit": "큰술"}}
  ],
  "instructions": [
    "1. 아보카도를 깍둑썰기 합니다.",
    "2. 올리브오일과 레몬즙을 섞어 드레싱을 만듭니다."
  ],
  "ketoNotes": "완벽한 케토 매크로 비율입니다. MCT 오일 추가 권장"
}}"""
```

#### 2. 이유식 프롬프트
```python
def build_baby_food_prompt(self, profile: Dict[str, Any]) -> str:
    """이유식 전문 프롬프트"""
    baby_age = profile.get('babyAge', 6)
    allergies = ', '.join(profile.get('allergies', [])) or '없음'
    
    return f"""당신은 소아영양 전문가입니다. 안전하고 영양가 있는 이유식 레시피를 생성해주세요:

아기 정보:
- 월령: {baby_age}개월
- 알레르기 이력: {allergies}

이유식 안전 기준:
- 월령에 적합한 식재료만 사용
- 질식 위험 없는 크기와 질감
- 소금, 설탕, 꿀 등 첨가물 금지

JSON 형식으로 응답:
{{
  "recipeName": "이유식명",
  "ageAppropriate": "6-8개월",
  "texture": "으깬 형태",
  "safetyNotes": "질식 위험 주의사항",
  "nutritionBenefits": "영양학적 이점"
}}"""
```

## 성능 최적화

### 1. 응답 캐싱
```python
from functools import lru_cache

@lru_cache(maxsize=100)
def get_cached_recipe(profile_hash: str) -> Dict[str, Any]:
    """자주 요청되는 레시피 캐싱"""
    return self.generate_recipe(json.loads(profile_hash))
```

### 2. 재시도 로직
```python
def generate_recipe_with_retry(self, profile: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
    """재시도 로직이 포함된 레시피 생성"""
    for attempt in range(max_retries):
        try:
            return self.generate_recipe(profile)
        except Exception as e:
            if 'ThrottlingException' in str(e) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 지수 백오프
                continue
            raise e
```

### 3. 에러 처리
```python
def handle_bedrock_error(self, error: Exception, profile: Dict[str, Any]) -> Dict[str, Any]:
    """Bedrock 에러 처리 및 fallback"""
    if 'ValidationException' in str(error):
        logger.error(f"Invalid prompt format: {error}")
        return self.get_fallback_recipe(profile.get('target'))
    elif 'ThrottlingException' in str(error):
        logger.warning(f"Rate limit exceeded: {error}")
        return self.get_fallback_recipe(profile.get('target'))
    else:
        logger.error(f"Unexpected Bedrock error: {error}")
        return self.get_fallback_recipe(profile.get('target'))
```

## IAM 권한 설정

### Lambda 실행 역할
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-1-20250805-v1:0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/ai-chef-sessions-dev",
        "arn:aws:dynamodb:us-east-1:*:table/ai-chef-results-dev"
      ]
    }
  ]
}
```

## 배포 및 테스트

### CloudFormation 설정
```yaml
BedrockLambdaRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    Policies:
      - PolicyName: BedrockAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - bedrock:InvokeModel
              Resource: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-1-20250805-v1:0'
```

### 테스트 스크립트
```python
def test_bedrock_integration():
    """Bedrock 통합 테스트"""
    client = BedrockClient()
    
    test_profile = {
        'target': 'keto',
        'healthConditions': ['diabetes'],
        'allergies': [],
        'cookingLevel': 'beginner',
        'budget': 30000
    }
    
    result = client.generate_recipe(test_profile)
    
    assert 'recipeName' in result
    assert 'ingredients' in result
    assert 'instructions' in result
    
    print("✅ Bedrock integration test passed!")
```

---
**작성일**: 2025-09-05  
**작성자**: Team21 AWS Hackathon  
**최종 업데이트**: Claude Opus 4.1 및 Python 구현 완료

class BedrockClient:
    def __init__(self, region: str = 'us-east-1'):
        self.client = boto3.client('bedrock-runtime', region_name=region)
        self.model_id = 'anthropic.claude-3-sonnet-20240229-v1:0'
        self.logger = logging.getLogger(__name__)
    
    def invoke_model(self, prompt: str, **kwargs) -> Dict[str, Any]:
        """Bedrock 모델 호출"""
        try:
            body = self._prepare_request_body(prompt, **kwargs)
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body)
            )
            
            return self._parse_response(response)
            
        except ClientError as e:
            self.logger.error(f"Bedrock API error: {e}")
            raise
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}")
            raise
    
    def _prepare_request_body(self, prompt: str, **kwargs) -> Dict:
        """요청 본문 준비"""
        return {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": kwargs.get('max_tokens', 4000),
            "temperature": kwargs.get('temperature', 0.7),
            "top_p": kwargs.get('top_p', 0.9),
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }
    
    def _parse_response(self, response) -> Dict[str, Any]:
        """응답 파싱"""
        response_body = json.loads(response['body'].read())
        content = response_body['content'][0]['text']
        
        try:
            # JSON 응답 파싱 시도
            return json.loads(content)
        except json.JSONDecodeError:
            # 일반 텍스트 응답
            return {'text': content}
```

## 프롬프트 엔지니어링

### 프롬프트 템플릿 시스템
```python
class PromptTemplate:
    def __init__(self, template: str):
        self.template = template
    
    def format(self, **kwargs) -> str:
        """템플릿 포맷팅"""
        return self.template.format(**kwargs)
    
    def validate_params(self, **kwargs) -> bool:
        """파라미터 검증"""
        import re
        placeholders = re.findall(r'\{(\w+)\}', self.template)
        return all(param in kwargs for param in placeholders)
```

### 케토 다이어트 프롬프트
```python
KETO_PROMPT_TEMPLATE = PromptTemplate("""
당신은 케토제닉 다이어트 전문 영양사입니다.

사용자 프로필:
- 건강 상태: {health_conditions}
- 알레르기: {allergies}
- 요리 실력: {cooking_level}
- 예산: {budget}원

케토 요구사항:
- 탄수화물: 5g 이하
- 지방: 70% 이상
- 단백질: 20-25%
- 칼로리: {max_calories}kcal 이하

JSON 형식으로 응답:
{{
  "recipeName": "레시피명",
  "description": "설명",
  "cookingTime": 30,
  "difficulty": "easy|medium|hard",
  "servings": 2,
  "ingredients": [
    {{"name": "재료명", "amount": "양", "unit": "단위"}}
  ],
  "instructions": ["조리 단계"],
  "nutritionTips": "영양 팁",
  "ketoNotes": "케토 관련 주의사항"
}}
""")
```

## 에러 핸들링 및 재시도

### 재시도 로직
```python
import time
from functools import wraps

def retry_on_throttle(max_retries: int = 3, base_delay: float = 1.0):
    """Throttling 에러 시 재시도 데코레이터"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except ClientError as e:
                    if e.response['Error']['Code'] == 'ThrottlingException':
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt)
                            time.sleep(delay)
                            continue
                    raise
            return func(*args, **kwargs)
        return wrapper
    return decorator

class EnhancedBedrockClient(BedrockClient):
    @retry_on_throttle(max_retries=3)
    def invoke_model(self, prompt: str, **kwargs) -> Dict[str, Any]:
        return super().invoke_model(prompt, **kwargs)
```

## 임베딩 생성 (Titan)

### 임베딩 클라이언트
```python
class TitanEmbeddingClient:
    def __init__(self, region: str = 'us-east-1'):
        self.client = boto3.client('bedrock-runtime', region_name=region)
        self.model_id = 'amazon.titan-embed-text-v1'
    
    def generate_embedding(self, text: str) -> List[float]:
        """텍스트 임베딩 생성"""
        try:
            body = {
                "inputText": text
            }
            
            response = self.client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(body)
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
            
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {e}")
            return [0.0] * 1536  # 기본 차원
```

## 성능 최적화

### 배치 처리
```python
async def batch_generate_recipes(profiles: List[Dict]) -> List[Dict]:
    """여러 레시피 배치 생성"""
    import asyncio
    
    async def generate_single_recipe(profile):
        client = BedrockClient()
        prompt = get_prompt_by_target(profile['target'], profile)
        return await client.invoke_model_async(prompt)
    
    tasks = [generate_single_recipe(profile) for profile in profiles]
    return await asyncio.gather(*tasks)
```

### 캐싱 전략
```python
from functools import lru_cache
import hashlib

class CachedBedrockClient(BedrockClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.cache = {}
    
    def _get_cache_key(self, prompt: str, **kwargs) -> str:
        """캐시 키 생성"""
        content = f"{prompt}_{json.dumps(kwargs, sort_keys=True)}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def invoke_model(self, prompt: str, **kwargs) -> Dict[str, Any]:
        cache_key = self._get_cache_key(prompt, **kwargs)
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        result = super().invoke_model(prompt, **kwargs)
        self.cache[cache_key] = result
        return result
```

## IAM 권한 설정

### 최소 권한 정책
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
        "arn:aws:bedrock:*:*:foundation-model/amazon.titan-embed-text-v1"
      ]
    }
  ]
}
```

## 모니터링 및 로깅

### CloudWatch 메트릭
```python
import boto3

class MetricsCollector:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
    
    def record_bedrock_invocation(self, model_id: str, duration: float, success: bool):
        """Bedrock 호출 메트릭 기록"""
        self.cloudwatch.put_metric_data(
            Namespace='AI-Chef/Bedrock',
            MetricData=[
                {
                    'MetricName': 'InvocationDuration',
                    'Value': duration,
                    'Unit': 'Seconds',
                    'Dimensions': [
                        {'Name': 'ModelId', 'Value': model_id}
                    ]
                },
                {
                    'MetricName': 'InvocationCount',
                    'Value': 1,
                    'Unit': 'Count',
                    'Dimensions': [
                        {'Name': 'ModelId', 'Value': model_id},
                        {'Name': 'Status', 'Value': 'Success' if success else 'Error'}
                    ]
                }
            ]
        )
```
