import { TargetInfo, Recipe, ChatMessage, UserTarget } from '@/types';

// 타겟 정보
export const targetInfos: TargetInfo[] = [
  {
    id: 'keto',
    name: '케톤 다이어트',
    description: '저탄수화물 고지방 식단으로 건강한 체중 관리',
    features: ['탄수화물 20g 이하', '케톤 비율 최적화', '매크로 자동 계산'],
    color: 'emerald',
    icon: '🥑'
  },
  {
    id: 'baby',
    name: '육아맘 이유식',
    description: '월령별 안전한 이유식과 영양 균형 식단',
    features: ['월령별 맞춤', '알레르기 체크', '영양소 균형'],
    color: 'rose',
    icon: '👶'
  },
  {
    id: 'diabetes',
    name: '당뇨 관리식',
    description: '혈당 관리를 위한 저GI 건강 식단',
    features: ['GI 지수 55 이하', '혈당 예측', '의료진 검증'],
    color: 'teal',
    icon: '💉'
  },
  {
    id: 'general',
    name: '일반 식단',
    description: '건강하고 맛있는 일상 요리 레시피',
    features: ['영양 균형', '간편 조리', '가족 식단'],
    color: 'orange',
    icon: '🍽️'
  },
  {
    id: 'fridge',
    name: '냉장고 파먹기',
    description: '냉장고 속 재료로 만드는 창의적 요리',
    features: ['재료 활용', '음식물 절약', '즉석 요리'],
    color: 'purple',
    icon: '🧊'
  }
];

// 샘플 레시피
export const sampleRecipes: Partial<Record<UserTarget, Recipe[]>> = {
  keto: [
    {
      id: 'keto-1',
      name: '아보카도 연어 샐러드',
      description: '오메가3가 풍부한 케토 친화적 샐러드',
      cookingTime: 15,
      difficulty: 'easy',
      servings: 2,
      ingredients: [
        { name: '아보카도', amount: '2', unit: '개', price: 3500, store: '네이버쇼핑', url: '#' },
        { name: '연어 회', amount: '200', unit: 'g', price: 8900, store: '네이버쇼핑', url: '#' },
        { name: '올리브오일', amount: '2', unit: 'tbsp', price: 1200, store: '네이버쇼핑', url: '#' },
        { name: '레몬', amount: '1/2', unit: '개', price: 800, store: '네이버쇼핑', url: '#' }
      ],
      instructions: [
        '아보카도를 반으로 잘라 씨를 제거하고 큐브 모양으로 자릅니다.',
        '연어 회를 한 입 크기로 자릅니다.',
        '올리브오일과 레몬즙을 섞어 드레싱을 만듭니다.',
        '모든 재료를 섞고 드레싱을 뿌려 완성합니다.'
      ],
      nutrition: { calories: 420, carbs: 8, protein: 32, fat: 45, fiber: 12 },
      tags: ['케토', '고지방', '저탄수화물', '오메가3'],
      totalPrice: 14400,
      targetSpecific: {
        keto: { netCarbs: 4, ketogenicRatio: 4.2 }
      }
    }
  ],
  baby: [
    {
      id: 'baby-1',
      name: '단호박 닭가슴살 퓨레',
      description: '12개월 아기를 위한 영양 만점 이유식',
      cookingTime: 25,
      difficulty: 'easy',
      servings: 3,
      ingredients: [
        { name: '단호박', amount: '200', unit: 'g', price: 2800, store: '네이버쇼핑', url: '#' },
        { name: '닭가슴살', amount: '100', unit: 'g', price: 4500, store: '네이버쇼핑', url: '#' },
        { name: '양파', amount: '1/4', unit: '개', price: 500, store: '네이버쇼핑', url: '#' }
      ],
      instructions: [
        '단호박을 껍질을 벗기고 작게 자릅니다.',
        '닭가슴살을 삶아서 잘게 찢습니다.',
        '양파를 잘게 다져 볶습니다.',
        '모든 재료를 믹서기에 넣고 부드럽게 갈아줍니다.'
      ],
      nutrition: { calories: 180, carbs: 15, protein: 18, fat: 2, fiber: 3 },
      tags: ['이유식', '12개월', '영양균형', '부드러움'],
      totalPrice: 7800,
      targetSpecific: {
        baby: { ageRange: '12-18개월', allergens: [], texture: '퓨레' }
      }
    }
  ],
  diabetes: [
    {
      id: 'diabetes-1',
      name: '현미 채소볶음',
      description: '혈당 관리에 좋은 저GI 식단',
      cookingTime: 20,
      difficulty: 'easy',
      servings: 2,
      ingredients: [
        { name: '현미밥', amount: '1', unit: '공기', price: 3200, store: '네이버쇼핑', url: '#' },
        { name: '브로콜리', amount: '150', unit: 'g', price: 2100, store: '네이버쇼핑', url: '#' },
        { name: '당근', amount: '1/2', unit: '개', price: 800, store: '네이버쇼핑', url: '#' },
        { name: '양배추', amount: '100', unit: 'g', price: 1200, store: '네이버쇼핑', url: '#' }
      ],
      instructions: [
        '브로콜리를 작은 송이로 나누어 데칩니다.',
        '당근과 양배추를 채 썰어 준비합니다.',
        '팬에 기름을 두르고 채소를 볶습니다.',
        '현미밥과 함께 볶아 완성합니다.'
      ],
      nutrition: { calories: 280, carbs: 45, protein: 12, fat: 3, fiber: 8 },
      tags: ['당뇨식', '저GI', '고섬유', '혈당관리'],
      totalPrice: 7300,
      targetSpecific: {
        diabetes: { glycemicIndex: 45, bloodSugarImpact: 'low' }
      }
    }
  ]
};

// 대화 시나리오
export const conversationScenarios: Partial<Record<UserTarget, ChatMessage[]>> = {
  keto: [
    { id: '1', type: 'ai', content: '안녕하세요! 케톤 다이어트를 시작하신 것을 축하드려요 🥑 어떤 레시피를 찾고 계신가요?', timestamp: new Date() },
    { id: '2', type: 'user', content: '간단하고 맛있는 샐러드 레시피 추천해주세요', timestamp: new Date() },
    { id: '3', type: 'ai', content: '완벽해요! 탄수화물은 얼마나 제한하고 계신가요? 그리고 특별히 좋아하시는 재료가 있나요?', timestamp: new Date() }
  ],
  baby: [
    { id: '1', type: 'ai', content: '안녕하세요! 소중한 아기를 위한 이유식을 준비해드릴게요 👶 아기가 몇 개월인가요?', timestamp: new Date() },
    { id: '2', type: 'user', content: '12개월이에요. 영양가 있는 이유식 만들고 싶어요', timestamp: new Date() },
    { id: '3', type: 'ai', content: '12개월이면 다양한 식재료를 시도할 수 있는 시기네요! 알레르기가 있는 식품이 있나요?', timestamp: new Date() }
  ],
  diabetes: [
    { id: '1', type: 'ai', content: '안녕하세요! 혈당 관리를 위한 건강한 식단을 도와드릴게요 💉 어떤 식사를 준비하고 계신가요?', timestamp: new Date() },
    { id: '2', type: 'user', content: '혈당에 좋은 점심 메뉴 추천해주세요', timestamp: new Date() },
    { id: '3', type: 'ai', content: '좋은 선택이에요! 현재 혈당 수치나 복용 중인 약물이 있으신가요? 더 정확한 추천을 위해 알려주세요.', timestamp: new Date() }
  ]
};
