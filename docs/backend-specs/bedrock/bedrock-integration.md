# Bedrock 연동 구현 가이드

## 개요
AWS Bedrock Claude 3을 활용한 AI 레시피 생성 시스템 구현

## Bedrock 모델 설정

### 지원 모델
```python
BEDROCK_MODELS = {
    'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
    'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
    'titan-embed': 'amazon.titan-embed-text-v1'
}
```

### 모델별 특성
- **Claude 3 Sonnet**: 균형잡힌 성능, 레시피 생성에 최적
- **Claude 3 Haiku**: 빠른 응답, 간단한 요청용
- **Titan Embeddings**: 영양소 RAG 검색용

## 기본 Bedrock 클라이언트

### 클라이언트 초기화 (bedrock_client.py)
```python
import boto3
import json
import logging
from typing import Dict, Any, Optional
from botocore.exceptions import ClientError

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
