import { Recipe, ChatMessage, UserTarget, ApiResponse, SessionResponse, AdditionalQuestionResponse } from '@/types';
import { sampleRecipes, conversationScenarios } from './mockData';
import { ApiService } from './api';

// API 응답 시뮬레이션을 위한 지연 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API 클래스
export class MockApiService {
  // 세션 시작 - 실제 API 호출
  static async startSession(): Promise<SessionResponse> {
    return await ApiService.startSession();
  }

  // 추가 질문 처리 API 시뮬레이션 (Mock Bedrock)
  static async processAdditionalQuestion(
    question: string, 
    sessionId: string,
    profile?: any
  ): Promise<AdditionalQuestionResponse> {
    // 1-2초 로딩 시뮬레이션 (Bedrock 호출 시뮬레이션)
    await delay(Math.random() * 1000 + 1000);
    
    // Mock Bedrock 응답 생성
    const response = this.generateMockBedrockResponse(question, profile);
    
    const responseData: AdditionalQuestionResponse = {
      response,
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    console.log('Mock Bedrock Response:', { question, response, sessionId });
    return responseData;
  }

  // Mock Bedrock 응답 생성 로직
  private static generateMockBedrockResponse(question: string, profile?: any): string {
    const lowerQuestion = question.toLowerCase();
    
    // 키워드 기반 응답 생성
    if (lowerQuestion.includes('매운') || lowerQuestion.includes('매워')) {
      return '매운 음식을 피하시는군요! 담백하고 순한 맛의 레시피로 준비하겠습니다. 🌶️';
    }
    
    if (lowerQuestion.includes('알레르기') || lowerQuestion.includes('알러지')) {
      return '알레르기 정보를 알려주셔서 감사해요. 해당 재료는 제외하고 안전한 레시피를 만들어드릴게요! 🛡️';
    }
    
    if (lowerQuestion.includes('시간') || lowerQuestion.includes('빨리') || lowerQuestion.includes('급해')) {
      return '시간이 부족하시는군요! 15분 이내로 완성할 수 있는 간단한 레시피를 추천해드릴게요. ⏰';
    }
    
    if (lowerQuestion.includes('예산') || lowerQuestion.includes('저렴') || lowerQuestion.includes('싸게')) {
      return '경제적인 식단을 원하시는군요! 가성비 좋은 재료로 맛있는 레시피를 만들어드릴게요. 💰';
    }
    
    if (lowerQuestion.includes('건강') || lowerQuestion.includes('다이어트') || lowerQuestion.includes('살')) {
      return '건강한 식단을 중요하게 생각하시는군요! 영양 균형을 고려한 저칼로리 레시피를 준비하겠습니다. 🥗';
    }
    
    if (lowerQuestion.includes('아이') || lowerQuestion.includes('아기') || lowerQuestion.includes('어린이')) {
      return '아이를 위한 음식이군요! 영양가 높고 안전한 재료로 아이가 좋아할 만한 레시피를 만들어드릴게요. 👶';
    }
    
    // 기본 응답
    const defaultResponses = [
      '네, 알겠습니다! 말씀해주신 내용을 레시피에 반영하겠어요. 🍳',
      '좋은 의견이네요! 그 부분을 고려해서 맞춤 레시피를 준비하겠습니다. ✨',
      '이해했습니다! 요청사항을 반영한 특별한 레시피를 만들어드릴게요. 👨‍🍳',
      '말씀해주신 점을 꼼꼼히 체크해서 완벽한 레시피를 준비하겠습니다! 📝'
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  }

  // 레시피 생성 API 시뮬레이션
  static async generateRecipe(
    target: UserTarget, 
    userMessage: string, 
    conversationHistory: ChatMessage[]
  ): Promise<ApiResponse<Recipe>> {
    // 1-3초 로딩 시뮬레이션
    await delay(Math.random() * 2000 + 1000);
    
    try {
      // 타겟별 샘플 레시피 중 랜덤 선택
      const recipes = sampleRecipes[target];
      if (!recipes || recipes.length === 0) {
        throw new Error(`No recipes available for target: ${target}`);
      }
      const randomRecipe = recipes[Math.floor(Math.random() * recipes.length)];
      
      // 사용자 메시지에 따라 레시피 약간 수정
      const customizedRecipe: Recipe = {
        ...randomRecipe,
        id: `${target}-${Date.now()}`,
        name: this.customizeRecipeName(randomRecipe.name, userMessage)
      };
      
      return {
        success: true,
        data: customizedRecipe,
        message: '레시피가 성공적으로 생성되었습니다!'
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: '레시피 생성 중 오류가 발생했습니다.'
        }
      };
    }
  }

  // AI 채팅 응답 시뮬레이션
  static async getChatResponse(
    target: UserTarget,
    userMessage: string,
    conversationHistory: ChatMessage[]
  ): Promise<ApiResponse<ChatMessage>> {
    // 0.5-1.5초 로딩 시뮬레이션
    await delay(Math.random() * 1000 + 500);
    
    try {
      const responses = this.getContextualResponses(target, userMessage, conversationHistory);
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: randomResponse,
        timestamp: new Date()
      };
      
      return {
        success: true,
        data: aiMessage
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: 'AI 응답 생성 중 오류가 발생했습니다.'
        }
      };
    }
  }

  // 가격 정보 업데이트 시뮬레이션
  static async updatePrices(recipeId: string): Promise<ApiResponse<Recipe>> {
    await delay(500);
    
    // 가격 변동 시뮬레이션 (±10%)
    const priceVariation = () => Math.random() * 0.2 - 0.1; // -10% ~ +10%
    
    return {
      success: true,
      message: '가격 정보가 업데이트되었습니다.'
    };
  }

  // 레시피 이름 커스터마이징
  private static customizeRecipeName(originalName: string, userMessage: string): string {
    const keywords = userMessage.toLowerCase();
    
    if (keywords.includes('간단') || keywords.includes('쉬운')) {
      return `간편한 ${originalName}`;
    }
    if (keywords.includes('맛있는') || keywords.includes('맛')) {
      return `맛있는 ${originalName}`;
    }
    if (keywords.includes('건강') || keywords.includes('영양')) {
      return `영양만점 ${originalName}`;
    }
    
    return originalName;
  }

  // 상황별 AI 응답 생성
  private static getContextualResponses(
    target: UserTarget,
    userMessage: string,
    history: ChatMessage[]
  ): string[] {
    const messageCount = history.filter(m => m.type === 'user').length;
    
    // 첫 번째 메시지인 경우
    if (messageCount === 1) {
      return this.getFirstResponses(target, userMessage);
    }
    
    // 두 번째 메시지인 경우
    if (messageCount === 2) {
      return this.getSecondResponses(target, userMessage);
    }
    
    // 레시피 생성 준비 응답
    return [
      '네, 모든 정보를 확인했습니다! 완벽한 레시피를 생성해드릴게요. 잠시만 기다려주세요 ⏳',
      '좋아요! 지금 맞춤 레시피를 만들고 있어요. 곧 완성됩니다! 🍳',
      '알겠습니다! 최적의 레시피와 가격 정보를 찾고 있어요. 조금만 기다려주세요! 💫'
    ];
  }

  private static getFirstResponses(target: UserTarget, userMessage: string): string[] {
    const responses: Record<UserTarget, string[]> = {
      keto: [
        '완벽해요! 케톤 다이어트에 최적화된 레시피를 추천해드릴게요. 탄수화물 제한량이나 특별한 선호도가 있나요? 🥑',
        '좋은 선택이에요! 고지방 저탄수화물 레시피로 도와드릴게요. 어떤 종류의 요리를 원하시나요? 🧀',
        '케토 다이어트 성공을 응원해요! 맛있고 건강한 레시피를 만들어드릴게요. 조리 시간은 얼마나 되면 좋을까요? ⏰'
      ],
      baby: [
        '소중한 아기를 위한 이유식이네요! 아기 월령과 알레르기 정보를 알려주시면 더 안전한 레시피를 추천해드릴게요 👶',
        '영양 만점 이유식을 준비해드릴게요! 아기가 현재 어떤 식재료를 먹고 있는지 알려주세요 🥄',
        '건강한 이유식 만들기를 도와드릴게요! 아기 개월 수와 선호하는 식감을 알려주시면 맞춤 레시피를 추천해드려요 🍼'
      ],
      diabetes: [
        '혈당 관리에 도움되는 건강한 식단을 준비해드릴게요! 현재 혈당 수치나 식이 제한사항이 있나요? 💉',
        '당뇨 관리식으로 도와드릴게요! GI 지수가 낮은 재료로 맛있는 요리를 만들어드릴게요. 어떤 식사를 원하시나요? 🥗',
        '혈당에 좋은 레시피를 추천해드릴게요! 복용 중인 약물이나 특별한 주의사항이 있으시면 알려주세요 📋'
      ],
      general: [
        '건강한 식단을 도와드릴게요! 어떤 종류의 요리를 원하시나요? 🍽️',
        '맛있고 영양가 있는 레시피를 추천해드릴게요! 선호하는 재료나 조리법이 있나요? 👨‍🍳',
        '균형 잡힌 식사를 준비해드릴게요! 특별한 식단 목표가 있으시면 알려주세요 🥘'
      ],
      fridge: [
        '냉장고 파먹기 도전이네요! 현재 가지고 있는 재료들을 알려주시면 창의적인 레시피를 만들어드릴게요 🧊',
        '알뜰한 요리 만들기를 도와드릴게요! 냉장고에 있는 재료 목록을 알려주세요 📝',
        '남은 재료로 맛있는 요리를 만들어드릴게요! 어떤 식재료들이 있는지 알려주세요 ♻️'
      ]
    };
    
    return responses[target];
  }

  private static getSecondResponses(target: UserTarget, userMessage: string): string[] {
    return [
      '네, 잘 알겠습니다! 이제 완벽한 레시피를 생성할 준비가 되었어요. 최적의 재료와 가격까지 함께 찾아드릴게요! ✨',
      '정보 감사해요! 맞춤형 레시피와 실시간 최저가 정보를 준비해드릴게요. 잠시만 기다려주세요! 🔍',
      '완벽해요! 모든 조건을 고려한 특별한 레시피를 만들어드릴게요. 가격 비교까지 완료해서 보여드릴게요! 💝'
    ];
  }
}
