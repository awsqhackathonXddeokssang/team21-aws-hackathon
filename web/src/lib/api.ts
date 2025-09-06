import { SessionResponse } from '@/types';
import { sampleRecipes } from './mockData';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Mock 데이터 저장소
const mockSessions: Map<string, any> = new Map();

export class ApiService {
  // Mock 지연 함수
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async startSession(): Promise<SessionResponse> {
    try {
      console.log('🌐 Mock API 호출 시작 - startSession');
      
      // 500-1000ms 지연으로 실제 API처럼 보이기
      await this.delay(Math.random() * 500 + 500);
      
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const sessionData = {
        sessionId,
        status: 'active',
        createdAt: new Date().toISOString(),
        profile: {}
      };
      
      // Mock 세션 저장
      mockSessions.set(sessionId, sessionData);
      
      console.log('✅ Mock Session Created:', sessionData);
      return sessionData;
    } catch (error) {
      console.error('❌ Session creation failed:', error);
      throw error;
    }
  }

  static async updateProfile(sessionId: string, profile: any, userPrompt?: string): Promise<any> {
    try {
      console.log('🔄 Mock API 호출 시작 - updateProfile');
      
      // 300-800ms 지연
      await this.delay(Math.random() * 500 + 300);
      
      // Mock 세션 업데이트
      const session = mockSessions.get(sessionId);
      if (!session) {
        throw new ApiError(404, 'Session not found');
      }
      
      // 음식 관련 키워드 체크 (Mock)
      if (userPrompt) {
        const nonFoodKeywords = ['날씨', '운동', '게임', '영화', '음악', '여행'];
        const isNonFood = nonFoodKeywords.some(keyword => 
          userPrompt.toLowerCase().includes(keyword)
        );
        
        if (isNonFood) {
          console.log('ℹ️ 음식 관련 내용이 아닙니다');
          return { 
            isNonFoodPrompt: true, 
            message: '음식과 관련된 질문을 해주세요! 예: "매운 음식을 못 먹어요", "15분 안에 만들 수 있는 요리"' 
          };
        }
      }
      
      // 프로필 업데이트
      session.profile = { ...session.profile, ...profile };
      if (userPrompt) {
        session.lastPrompt = userPrompt;
      }
      
      mockSessions.set(sessionId, session);
      
      console.log('✅ Mock Profile Updated:', session);
      return {
        success: true,
        sessionId,
        profile: session.profile,
        message: '프로필이 업데이트되었습니다.'
      };
    } catch (error) {
      console.error('❌ Profile update failed:', error);
      throw error;
    }
  }

  static async processRecipe(sessionId: string): Promise<any> {
    try {
      console.log('🍳 Mock API 호출 시작 - processRecipe');
      
      // 500-1000ms 지연
      await this.delay(Math.random() * 500 + 500);
      
      const session = mockSessions.get(sessionId);
      if (!session) {
        throw new ApiError(404, 'Session not found');
      }
      
      // 처리 상태 초기화
      session.status = 'processing';
      session.processStartedAt = new Date().toISOString();
      session.recipeStatus = 'processing';
      session.nutritionStatus = 'idle';
      session.priceStatus = 'idle';
      session.imageStatus = 'idle';
      
      mockSessions.set(sessionId, session);
      
      // 비동기로 레시피 처리 시뮬레이션 시작 (실제 서버처럼)
      this.simulateRecipeProcessing(sessionId);
      
      console.log('✅ Mock Recipe Processing Started:', { sessionId, status: 'processing' });
      return {
        success: true,
        sessionId,
        message: '레시피 생성을 시작했습니다.',
        status: 'processing'
      };
    } catch (error) {
      console.error('❌ Recipe processing failed:', error);
      throw error;
    }
  }

  // 레시피 처리 시뮬레이션
  private static async simulateRecipeProcessing(sessionId: string) {
    const session = mockSessions.get(sessionId);
    if (!session) return;

    // 타겟별 샘플 레시피 선택
    const target = session.profile?.target || 'general';
    const recipes = sampleRecipes[target as keyof typeof sampleRecipes] || sampleRecipes.general;
    const selectedRecipe = recipes?.[0] || {
      id: `recipe-${Date.now()}`,
      name: '맛있는 토마토 파스타',
      description: '간단하고 맛있는 토마토 파스타',
      cookingTime: 20,
      difficulty: 'easy',
      servings: 2,
      ingredients: [
        { name: '파스타면', amount: '200', unit: 'g', price: 2500, store: '네이버쇼핑', url: '#' },
        { name: '토마토 소스', amount: '300', unit: 'g', price: 3500, store: '네이버쇼핑', url: '#' },
        { name: '올리브오일', amount: '2', unit: 'tbsp', price: 1200, store: '네이버쇼핑', url: '#' },
        { name: '마늘', amount: '3', unit: '쪽', price: 500, store: '네이버쇼핑', url: '#' }
      ],
      instructions: [
        '파스타면을 끓는 물에 8-10분간 삶습니다.',
        '팬에 올리브오일을 두르고 마늘을 볶습니다.',
        '토마토 소스를 넣고 5분간 끓입니다.',
        '삶은 파스타를 소스와 섞어 완성합니다.'
      ],
      nutrition: { calories: 450, carbs: 65, protein: 15, fat: 12, fiber: 5 },
      tags: ['간편요리', '파스타', '이탈리안'],
      totalPrice: 7700
    };

    // 단계별 처리 시뮬레이션
    setTimeout(() => {
      session.recipeStatus = 'completed';
      session.recipe = selectedRecipe;
      mockSessions.set(sessionId, session);
      console.log('📝 Mock Recipe Generated');
    }, 2000);

    setTimeout(() => {
      session.nutritionStatus = 'processing';
      mockSessions.set(sessionId, session);
    }, 3000);

    setTimeout(() => {
      session.nutritionStatus = 'completed';
      session.nutritionData = {
        detailed: {
          vitamins: { A: 15, C: 25, D: 5, E: 10 },
          minerals: { calcium: 120, iron: 8, potassium: 350 },
          dailyValue: {
            calories: 22,
            carbs: 24,
            protein: 30,
            fat: 18
          }
        }
      };
      mockSessions.set(sessionId, session);
      console.log('🥗 Mock Nutrition Data Generated');
    }, 4500);

    setTimeout(() => {
      session.priceStatus = 'processing';
      mockSessions.set(sessionId, session);
    }, 5500);

    setTimeout(() => {
      session.priceStatus = 'completed';
      
      // 실제 화면에서 사용하는 recommendationsData 구조로 생성
      // 재료별 이미지 맵핑 (실제 이미지 또는 이모지)
      const ingredientImages: { [key: string]: string } = {
        '아보카도': '🥑',
        '연어': '🐟',
        '단호박': '🎃',
        '닭가슴살': '🍗',
        '현미밥': '🍚',
        '브로콜리': '🥦',
        '당근': '🥕',
        '양배추': '🥬',
        '파스타면': '🍝',
        '토마토': '🍅',
        '마늘': '🧄',
        '양파': '🧅',
        '김치': '🥬',
        '돼지고기': '🥩',
        '두부': '🟦',
        '대파': '🌿',
        '계란': '🥚',
        '밥': '🍚',
        '라면': '🍜',
        '올리브오일': '🫒',
        '레몬': '🍋',
        '간장': '🍶',
        '참기름': '🫙'
      };
      
      const getIngredientImage = (name: string) => {
        // 재료명에서 키워드 찾기
        for (const [key, emoji] of Object.entries(ingredientImages)) {
          if (name.includes(key)) return emoji;
        }
        return '🛒'; // 기본 이모지
      };
      
      const mockVendors = [
        {
          vendor: '네이버쇼핑',
          itemCount: selectedRecipe.ingredients.length,
          totalPrice: selectedRecipe.totalPrice,
          items: selectedRecipe.ingredients.map((ing: any) => ({
            ingredient: ing.name,
            name: `${ing.name} ${ing.amount}${ing.unit}`,
            price: ing.price,
            amount: ing.amount,
            unit: ing.unit,
            link: ing.url,
            emoji: getIngredientImage(ing.name)
          }))
        },
        {
          vendor: '쿠팡',
          itemCount: Math.floor(selectedRecipe.ingredients.length * 0.7),
          totalPrice: Math.floor(selectedRecipe.totalPrice * 0.95),
          items: selectedRecipe.ingredients.slice(0, Math.floor(selectedRecipe.ingredients.length * 0.7)).map((ing: any) => ({
            ingredient: ing.name,
            name: `${ing.name} ${ing.amount}${ing.unit}`,
            price: Math.floor(ing.price * 0.95),
            amount: ing.amount,
            unit: ing.unit,
            link: '#',
            emoji: getIngredientImage(ing.name)
          }))
        },
        {
          vendor: '마켓컬리',
          itemCount: Math.floor(selectedRecipe.ingredients.length * 0.5),
          totalPrice: Math.floor(selectedRecipe.totalPrice * 1.1),
          items: selectedRecipe.ingredients.slice(0, Math.floor(selectedRecipe.ingredients.length * 0.5)).map((ing: any) => ({
            ingredient: ing.name,
            name: `프리미엄 ${ing.name} ${ing.amount}${ing.unit}`,
            price: Math.floor(ing.price * 1.1),
            amount: ing.amount,
            unit: ing.unit,
            link: '#',
            emoji: getIngredientImage(ing.name)
          }))
        }
      ];
      
      session.priceData = {
        recommendations: {
          optimalVendors: mockVendors,
          totalEstimatedCost: selectedRecipe.totalPrice,
          savingsAmount: Math.floor(selectedRecipe.totalPrice * 0.05),
          savingsPercentage: 5
        }
      };
      mockSessions.set(sessionId, session);
      console.log('💰 Mock Price Data Generated with vendor details');
    }, 7000);

    setTimeout(() => {
      session.imageStatus = 'processing';
      mockSessions.set(sessionId, session);
    }, 8000);

    setTimeout(() => {
      session.imageStatus = 'completed';
      
      // 실제 S3 이미지 URL 중 랜덤 선택
      const recipeImages = [
        'https://ai-chef-images.s3.us-east-1.amazonaws.com/sess_03e6b4d5-aa73-4935-be42-ed3d5ca3c33b_image.png',
        'https://ai-chef-images.s3.us-east-1.amazonaws.com/sess_04a98097-bfbd-4b64-8625-355870a7fb7e_image.png',
        'https://ai-chef-images.s3.us-east-1.amazonaws.com/sess_1124019b-3e86-474f-9e32-015a256de68e_image.png'
      ];
      
      session.imageUrl = recipeImages[Math.floor(Math.random() * recipeImages.length)];
      session.status = 'completed';
      mockSessions.set(sessionId, session);
      console.log('🖼️ Mock Image Generated:', session.imageUrl);
      console.log('✅ All Mock Processing Completed!');
    }, 10000);
  }

  // Mock 세션 상태 조회
  static async getSessionStatus(sessionId: string): Promise<any> {
    await this.delay(100);
    const session = mockSessions.get(sessionId);
    if (!session) {
      throw new ApiError(404, 'Session not found');
    }
    return {
      sessionId,
      status: session.status || 'idle',
      recipeStatus: session.recipeStatus || 'idle',
      nutritionStatus: session.nutritionStatus || 'idle',
      priceStatus: session.priceStatus || 'idle',
      imageStatus: session.imageStatus || 'idle'
    };
  }

  // Mock 세션 결과 조회
  static async getSessionResult(sessionId: string): Promise<any> {
    await this.delay(100);
    const session = mockSessions.get(sessionId);
    if (!session) {
      throw new ApiError(404, 'Session not found');
    }
    return {
      sessionId,
      result: {
        recipe: session.recipe,
        nutrition: session.nutritionData,
        price: session.priceData,
        imageUrl: session.imageUrl
      },
      status: session.status
    };
  }
}
