// 사용자 타겟 타입
export type UserTarget = 'keto' | 'baby' | 'diabetes' | 'general' | 'fridge';

// 사용자 타겟 정보
export interface TargetInfo {
  id: UserTarget;
  name: string;
  description: string;
  features: string[];
  color: string;
  icon: string;
}

// 재료 정보
export interface Ingredient {
  name: string;
  amount: string;
  unit?: string;
  price?: number;
  store?: string;
  url?: string;
  prices?: Array<{vendor: string; price: number; url?: string}>;
}

// 영양 정보
export interface NutritionInfo {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  carbsPercent?: number;    // ChatScreen에서 사용
  proteinPercent?: number;  // ChatScreen에서 사용
  fatPercent?: number;      // ChatScreen에서 사용
}

// 레시피 정보
export interface Recipe {
  id: string;
  name: string;
  description: string;
  cookingTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: NutritionInfo;
  tags: string[];
  totalPrice?: number;
  targetSpecific?: {
    keto?: { netCarbs: number; ketogenicRatio: number };
    baby?: { ageRange: string; allergens: string[]; texture: string };
    diabetes?: { glycemicIndex: number; bloodSugarImpact: 'low' | 'medium' | 'high' };
  };
}

// 세션 응답
export interface SessionResponse {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
}

// 추가 질문 응답
export interface AdditionalQuestionResponse {
  response: string;
  sessionId: string;
  timestamp: string;
}

// 채팅 메시지
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  messageType?: 'text' | 'choice' | 'ingredients' | 'additional_question' | 'text_input';
  options?: string[];
  selectedOption?: string;
  additionalQuestions?: string[]; // 사용자가 입력한 추가 질문들
}

// API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message: string;
    details?: any;
  };
  message?: string;
  metadata?: {
    source?: string;
    timestamp?: string;
    processingTime?: number;
  };
}

// 세션 정보
export interface Session {
  id: string;
  target: UserTarget;
  messages: ChatMessage[];
  currentRecipe?: Recipe;
  preferences: {
    allergies?: string[];
    dislikes?: string[];
    cookingTime?: number;
    budget?: number;
  };
  status: 'created' | 'idle' | 'processing' | 'completed' | 'failed';
  nutritionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  recipeStatus: 'pending' | 'processing' | 'completed' | 'failed';
  imageStatus: 'pending' | 'processing' | 'completed' | 'failed';
  priceStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

// 세션 상태 추적
export interface SessionStatus {
  sessionId: string;
  status: 'created' | 'idle' | 'processing' | 'completed' | 'failed';
  nutritionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  recipeStatus: 'pending' | 'processing' | 'completed' | 'failed';
  imageStatus: 'pending' | 'processing' | 'completed' | 'failed';
  priceStatus: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  phase?: string;
  error?: string;
}
