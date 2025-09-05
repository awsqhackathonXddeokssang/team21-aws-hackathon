"""
Bedrock을 활용한 RAG 시스템 유틸리티 함수들
"""

import json
import boto3
import re
from typing import List, Dict, Tuple, Optional

class BedrockRAGSystem:
    def __init__(self, region='us-east-1'):
        self.bedrock_runtime = boto3.client('bedrock-runtime', region_name=region)
        self.embedding_model_id = 'amazon.titan-embed-g1-text-02'
        self.llm_model_id = 'anthropic.claude-opus-4-1-20250805-v1:0'
    
    def get_embedding(self, text: str) -> List[float]:
        """텍스트를 벡터 임베딩으로 변환"""
        try:
            body = json.dumps({"inputText": text})
            
            response = self.bedrock_runtime.invoke_model(
                modelId=self.embedding_model_id,
                body=body,
                contentType='application/json'
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
            
        except Exception as e:
            print(f"Error generating embedding: {str(e)}")
            return []
    
    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """여러 텍스트를 배치로 임베딩 생성"""
        embeddings = []
        for text in texts:
            embedding = self.get_embedding(text)
            embeddings.append(embedding)
        return embeddings
    
    def parse_ingredient(self, ingredient_text: str) -> Tuple[str, float]:
        """재료 텍스트에서 재료명과 양을 분리"""
        # 정규식으로 양과 단위 추출
        pattern = r'(\d+(?:\.\d+)?)\s*(g|kg|ml|l|개|컵|큰술|작은술)'
        match = re.search(pattern, ingredient_text)
        
        if match:
            amount = float(match.group(1))
            unit = match.group(2)
            ingredient_name = re.sub(pattern, '', ingredient_text).strip()
            
            # 단위를 그램으로 통일
            if unit == 'kg':
                amount *= 1000
            elif unit == 'l':
                amount *= 1000  # 물 기준
            elif unit == 'ml':
                pass  # ml는 대략 g과 동일하게 처리
            elif unit == '컵':
                amount *= 200  # 1컵 = 200g 기준
            elif unit == '큰술':
                amount *= 15   # 1큰술 = 15g 기준
            elif unit == '작은술':
                amount *= 5    # 1작은술 = 5g 기준
            elif unit == '개':
                amount *= 100  # 평균 100g으로 가정
            
            return ingredient_name, amount
        else:
            # 양이 명시되지 않은 경우 100g으로 가정
            return ingredient_text.strip(), 100.0
    
    def calculate_nutrition(self, base_nutrition: Dict, amount_g: float) -> Dict:
        """100g 기준 영양소 정보를 실제 양에 맞게 계산"""
        ratio = amount_g / 100.0
        
        return {
            'ingredient': f"{base_nutrition.get('ingredient_name', '')} {amount_g}g",
            'calories': round(base_nutrition.get('calories_per_100g', 0) * ratio, 1),
            'protein': round(base_nutrition.get('protein', 0) * ratio, 1),
            'fat': round(base_nutrition.get('fat', 0) * ratio, 1),
            'carbs': round(base_nutrition.get('carbs', 0) * ratio, 1),
            'fiber': round(base_nutrition.get('fiber', 0) * ratio, 1),
            'sodium': round(base_nutrition.get('sodium', 0) * ratio, 1)
        }
    
    def sum_nutrition(self, nutrition_list: List[Dict]) -> Dict:
        """여러 재료의 영양소를 합계"""
        total = {
            'total_calories': 0,
            'total_protein': 0,
            'total_fat': 0,
            'total_carbs': 0,
            'total_fiber': 0,
            'total_sodium': 0
        }
        
        for nutrition in nutrition_list:
            total['total_calories'] += nutrition.get('calories', 0)
            total['total_protein'] += nutrition.get('protein', 0)
            total['total_fat'] += nutrition.get('fat', 0)
            total['total_carbs'] += nutrition.get('carbs', 0)
            total['total_fiber'] += nutrition.get('fiber', 0)
            total['total_sodium'] += nutrition.get('sodium', 0)
        
        # 소수점 1자리로 반올림
        for key in total:
            total[key] = round(total[key], 1)
        
        return total
    
    def generate_nutrition_analysis(self, nutrition_data: Dict, user_profile: Dict = None) -> str:
        """영양소 정보를 바탕으로 AI 분석 생성"""
        
        # 프롬프트 구성
        prompt = self._build_nutrition_prompt(nutrition_data, user_profile)
        
        try:
            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "temperature": 0.1,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
            
            response = self.bedrock_runtime.invoke_model(
                modelId=self.llm_model_id,
                body=body,
                contentType='application/json'
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['content'][0]['text']
            
        except Exception as e:
            print(f"Error generating analysis: {str(e)}")
            return "영양소 분석을 생성할 수 없습니다."
    
    def _build_nutrition_prompt(self, nutrition_data: Dict, user_profile: Dict = None) -> str:
        """영양소 분석을 위한 프롬프트 구성"""
        
        ingredient_details = nutrition_data.get('ingredient_details', [])
        total_nutrition = nutrition_data.get('total_nutrition', {})
        
        # 재료별 영양소 정보 텍스트 생성
        ingredient_text = "\n".join([
            f"- {item['ingredient']}: {item['calories']}kcal, 단백질 {item['protein']}g, 지방 {item['fat']}g, 탄수화물 {item['carbs']}g"
            for item in ingredient_details
        ])
        
        # 사용자 프로필 정보
        user_goal = user_profile.get('goal', '건강한 식단') if user_profile else '건강한 식단'
        restrictions = user_profile.get('restrictions', []) if user_profile else []
        restrictions_text = ', '.join(restrictions) if restrictions else '없음'
        
        prompt = f"""다음 레시피의 영양소 정보를 분석하여 건강상 이점과 주의사항을 설명해주세요:

레시피 재료별 영양소:
{ingredient_text}

총 영양소:
- 칼로리: {total_nutrition.get('total_calories', 0)}kcal
- 단백질: {total_nutrition.get('total_protein', 0)}g
- 지방: {total_nutrition.get('total_fat', 0)}g  
- 탄수화물: {total_nutrition.get('total_carbs', 0)}g
- 식이섬유: {total_nutrition.get('total_fiber', 0)}g
- 나트륨: {total_nutrition.get('total_sodium', 0)}mg

사용자 프로필:
- 목표: {user_goal}
- 제한사항: {restrictions_text}

다음 형식으로 답변해주세요:
1. 영양소 균형 평가
2. 건강상 이점
3. 주의사항 (있다면)
4. 개선 제안 (있다면)

답변은 한국어로 친근하고 이해하기 쉽게 작성해주세요."""

        return prompt
    
    def find_similar_ingredients(self, ingredient_name: str, opensearch_client, top_k: int = 3) -> List[str]:
        """유사한 재료명 찾기"""
        try:
            # 재료명으로 임베딩 생성
            embedding = self.get_embedding(ingredient_name)
            
            # 유사도 검색
            search_body = {
                "query": {
                    "knn": {
                        "embedding": {
                            "vector": embedding,
                            "k": top_k
                        }
                    }
                },
                "_source": ["ingredient_name"]
            }
            
            response = opensearch_client.search(
                index="ingredient-nutrition",
                body=search_body
            )
            
            suggestions = []
            for hit in response['hits']['hits']:
                suggestions.append(hit['_source']['ingredient_name'])
            
            return suggestions
            
        except Exception as e:
            print(f"Error finding similar ingredients: {str(e)}")
            return []
