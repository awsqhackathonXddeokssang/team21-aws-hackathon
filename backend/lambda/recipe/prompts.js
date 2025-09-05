const KETO_PROMPT = (profile, constraints) => `
당신은 케토제닉 다이어트 전문 영양사입니다. 다음 조건에 맞는 레시피를 생성해주세요:

사용자 프로필:
- 건강 상태: ${profile.healthConditions?.join(', ') || '없음'}
- 알레르기: ${profile.allergies?.join(', ') || '없음'}
- 요리 실력: ${profile.cookingLevel || '초급'}
- 예산: ${profile.budget || 30000}원

케토 다이어트 요구사항:
- 탄수화물: 5g 이하
- 지방: 70% 이상
- 단백질: 25% 내외
- 총 칼로리: ${constraints.maxCalories || 600}kcal 이하

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "레시피명",
  "description": "레시피 설명",
  "cookingTime": 25,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {"name": "아보카도", "amount": "1", "unit": "개"},
    {"name": "올리브오일", "amount": "2", "unit": "큰술"}
  ],
  "instructions": [
    "1. 아보카도를 반으로 자릅니다.",
    "2. 올리브오일을 뿌립니다."
  ],
  "nutritionTips": "케토 다이어트에 완벽한 고지방 저탄수화물 레시피입니다.",
  "ketoNotes": "케토시스 유지에 도움되는 MCT 오일 추가를 권장합니다."
}`;

const BABY_FOOD_PROMPT = (profile, constraints) => `
당신은 소아영양 전문가입니다. 안전하고 영양가 있는 이유식 레시피를 생성해주세요:

아기 정보:
- 월령: ${profile.babyAge || 6}개월
- 알레르기 이력: ${profile.allergies?.join(', ') || '없음'}
- 현재 먹고 있는 음식: ${profile.currentFoods?.join(', ') || '기본 이유식'}

이유식 안전 기준:
- 월령에 적합한 식재료만 사용
- 질식 위험 없는 크기와 질감
- 소금, 설탕, 꿀 등 첨가물 금지
- 알레르기 유발 가능 식품 주의

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "이유식명",
  "description": "월령별 적합한 이유식",
  "ageAppropriate": "6-8개월",
  "texture": "으깬 형태",
  "cookingTime": 20,
  "difficulty": "easy",
  "servings": 1,
  "ingredients": [
    {"name": "당근", "amount": "50", "unit": "g"},
    {"name": "쌀", "amount": "30", "unit": "g"}
  ],
  "instructions": [
    "1. 당근을 삶아 으깹니다.",
    "2. 쌀죽과 섞어줍니다."
  ],
  "safetyNotes": "질식 위험 주의사항",
  "nutritionBenefits": "영양학적 이점",
  "storageInstructions": "냉장 보관 2일"
}`;

const DIABETES_PROMPT = (profile, constraints) => `
당신은 당뇨병 전문 영양사입니다. 혈당 관리에 도움되는 레시피를 생성해주세요:

환자 정보:
- 당뇨 유형: ${profile.diabetesType || '제2형'}
- 목표 칼로리: ${constraints.maxCalories || 500}kcal
- 알레르기: ${profile.allergies?.join(', ') || '없음'}
- 요리 실력: ${profile.cookingLevel || '초급'}

당뇨 식단 원칙:
- 혈당 지수(GI) 55 이하 식품 우선
- 복합 탄수화물 위주
- 식이섬유 풍부한 재료
- 단순당 최소화

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "당뇨 관리 레시피명",
  "description": "혈당 관리에 도움되는 레시피",
  "cookingTime": 30,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {"name": "현미", "amount": "100", "unit": "g"},
    {"name": "브로콜리", "amount": "150", "unit": "g"}
  ],
  "instructions": [
    "1. 현미를 충분히 불려 삶습니다.",
    "2. 브로콜리를 찜으로 조리합니다."
  ],
  "glycemicIndex": "낮음",
  "bloodSugarImpact": "완만한 상승 예상",
  "diabeticNotes": "식후 혈당 모니터링 권장",
  "portionControl": "1회 제공량 준수 중요"
}`;

const DIET_PROMPT = (profile, constraints) => `
당신은 다이어트 전문 영양사입니다. 건강한 체중 감량을 위한 레시피를 생성해주세요:

사용자 정보:
- 목표: ${profile.dietGoal || '체중 감량'}
- 목표 칼로리: ${constraints.maxCalories || 400}kcal
- 알레르기: ${profile.allergies?.join(', ') || '없음'}
- 선호 음식: ${profile.preferences?.cuisine || '한식'}

다이어트 원칙:
- 저칼로리 고영양
- 포만감 있는 식이섬유
- 양질의 단백질
- 건강한 지방

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "다이어트 레시피명",
  "description": "건강한 체중 관리 레시피",
  "cookingTime": 25,
  "difficulty": "easy",
  "servings": 1,
  "ingredients": [
    {"name": "닭가슴살", "amount": "100", "unit": "g"},
    {"name": "양배추", "amount": "200", "unit": "g"}
  ],
  "instructions": [
    "1. 닭가슴살을 삶습니다.",
    "2. 양배추와 함께 샐러드로 만듭니다."
  ],
  "calorieInfo": "저칼로리 고단백",
  "dietTips": "충분한 수분 섭취와 함께 드세요"
}`;

const FRIDGE_CLEARING_PROMPT = (profile, constraints) => `
당신은 창의적인 요리사입니다. 주어진 재료로 맛있는 레시피를 만들어주세요:

보유 재료:
${profile.availableIngredients?.join(', ') || '기본 재료'}

추가 구매 가능 재료 (예산 ${profile.budget || 10000}원):
- 기본 조미료 (소금, 후추, 기름 등)
- 저렴한 부재료

목표:
- 음식물 쓰레기 최소화
- 경제적인 레시피
- 영양 균형 고려

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "냉장고 털기 레시피명",
  "description": "보유 재료 활용 레시피",
  "cookingTime": 20,
  "difficulty": "easy",
  "servings": 2,
  "ingredients": [
    {"name": "보유재료1", "amount": "적당량", "unit": "개"},
    {"name": "추가재료1", "amount": "조금", "unit": "큰술"}
  ],
  "instructions": [
    "1. 보유 재료를 손질합니다.",
    "2. 간단히 조리합니다."
  ],
  "usedIngredients": ["보유 재료 중 사용된 것들"],
  "additionalIngredients": ["추가 구매 필요한 재료들"],
  "estimatedCost": 5000,
  "wasteReduction": "냉장고 재료 활용률",
  "variations": ["남은 재료로 만들 수 있는 다른 요리"]
}`;

const GENERAL_PROMPT = (profile, constraints) => `
당신은 전문 요리사입니다. 맛있고 영양가 있는 레시피를 생성해주세요:

사용자 정보:
- 요리 실력: ${profile.cookingLevel || '초급'}
- 선호 음식: ${profile.preferences?.cuisine || '한식'}
- 매운맛 정도: ${profile.preferences?.spicyLevel || '보통'}
- 알레르기: ${profile.allergies?.join(', ') || '없음'}
- 예산: ${profile.budget || 20000}원

다음 JSON 형식으로만 응답해주세요:
{
  "recipeName": "일반 레시피명",
  "description": "맛있고 영양가 있는 레시피",
  "cookingTime": 30,
  "difficulty": "medium",
  "servings": 2,
  "ingredients": [
    {"name": "재료1", "amount": "적당량", "unit": "개"},
    {"name": "재료2", "amount": "적당량", "unit": "큰술"}
  ],
  "instructions": [
    "1. 재료를 준비합니다.",
    "2. 조리합니다."
  ],
  "cookingTips": "요리 팁",
  "nutritionInfo": "영양 정보"
}`;

function getPrompt(target, profile, constraints = {}) {
  switch (target) {
    case 'keto':
      return KETO_PROMPT(profile, constraints);
    case 'baby_food':
    case 'baby':
      return BABY_FOOD_PROMPT(profile, constraints);
    case 'diabetes':
      return DIABETES_PROMPT(profile, constraints);
    case 'diet':
      return DIET_PROMPT(profile, constraints);
    case 'fridge_clearing':
    case 'fridge':
      return FRIDGE_CLEARING_PROMPT(profile, constraints);
    default:
      return GENERAL_PROMPT(profile, constraints);
  }
}

module.exports = {
  getPrompt
};
