'use client';

import { useState, useEffect, useRef } from 'react';
import { UserTarget, ChatMessage, Recipe } from '@/types';
import { targetInfos } from '@/lib/mockData';
import { Loader2, ChefHat } from 'lucide-react';
import ResultModal from './ResultModal';
import { ApiService } from '@/lib/api';
import { createScrollHandler } from '@/lib/scrollUtils';

export default function ChatScreen() {
  const [selectedTarget, setSelectedTarget] = useState<UserTarget | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [additionalQuestions, setAdditionalQuestions] = useState<string[]>([]);
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');  // 세션 ID 관리
  const [conversationPhase, setConversationPhase] = useState<'basic' | 'additional' | 'complete'>('basic');
  const [activeTab, setActiveTab] = useState<'recipe' | 'shopping' | 'nutrition'>('recipe');
  const [checkedItems, setCheckedItems] = useState<{[key: string]: boolean}>({});

  // 자동 스크롤을 위한 ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스마트 스크롤 핸들러 생성
  const scrollToBottom = createScrollHandler(messagesEndRef);

  // 마지막 메시지 기반 선택지 표시 로직
  const lastMessage = messages[messages.length - 1];
  const hasValidSession = sessionId && sessionId !== '';
  const shouldShowOptions = hasValidSession && lastMessage?.messageType === 'choice' && lastMessage?.options;
  const shouldShowTextInput = hasValidSession && lastMessage?.messageType === 'text_input';

  // 세션 초기화
  useEffect(() => {
    console.log('🚀 ChatScreen useEffect 시작');
    
    // 새로고침 시 로컬 스토리지 클리어
    localStorage.clear();
    console.log('🗑️ 로컬 스토리지 클리어 완료');
    
    const initializeSession = async () => {
      try {
        console.log('📞 세션 생성 API 호출 시작...');
        // 항상 새 세션 생성
        const sessionData = await ApiService.startSession();
        console.log('✅ 세션 생성 성공:', sessionData);
        
        // 서버에서 받은 세션 ID를 state와 localStorage에 저장
        setSessionId(sessionData.sessionId);
        localStorage.setItem('sessionId', sessionData.sessionId);
        localStorage.setItem('sessionData', JSON.stringify(sessionData));
        
        console.log('💾 SessionId 저장 완료:', sessionData.sessionId);
        console.log('💾 로컬 스토리지 저장 완료');
      } catch (error) {
        console.error('❌ 세션 초기화 실패:', error);
        // Fallback: 임시 세션 ID 생성
        const fallbackId = `temp-${Date.now()}`;
        setSessionId(fallbackId);
        localStorage.setItem('sessionId', fallbackId);
        console.log('🔄 Fallback session created:', fallbackId);
      }
    };
    
    console.log('🎯 initializeSession 함수 호출');
    initializeSession();
  }, []);

  // 메시지 변경 시 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // 초기 AI 메시지들
  useEffect(() => {
    const initialMessages: ChatMessage[] = [
      {
        id: 'greeting',
        type: 'ai',
        content: '안녕하세요! AI 셰프입니다 👨🍳\n맞춤형 레시피를 추천해드릴게요.\n먼저 몇 가지 여쭤볼게요!',
        timestamp: new Date()
      },
      {
        id: 'question',
        type: 'ai',
        content: '어떤 식단을 하고 계신가요?',
        timestamp: new Date()
      }
    ];
    setMessages(initialMessages);
  }, []);

  const handleTargetSelect = async (target: UserTarget) => {
    // 세션 초기화 완료 대기
    if (!sessionId) {
      console.log('⏳ 세션 초기화 중... 잠시 후 다시 시도해주세요.');
      return;
    }

    setSelectedTarget(target);
    
    const targetInfo = targetInfos.find(t => t.id === target);
    
    // 사용자 선택 메시지 추가
    const userMessage: ChatMessage = {
      id: `user-target-${Date.now()}`,
      type: 'user',
      content: `${targetInfo?.icon} ${targetInfo?.name}`,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 서버에 즉시 동기화
      const currentSessionId = sessionId || localStorage.getItem('sessionId') || '';
      if (!currentSessionId) {
        console.error('Session not initialized');
        setIsLoading(false);
        return;
      }
      await ApiService.updateProfile(currentSessionId, { target });
      console.log('✅ Target saved to server:', target);

      // AI 응답 메시지 추가
      const aiResponse: ChatMessage = {
        id: `ai-response-${Date.now()}`,
        type: 'ai',
        content: getTargetResponseMessage(target),
        timestamp: new Date()
      };

      const nextQuestion: ChatMessage = {
        id: `ai-question-${Date.now()}`,
        type: 'ai',
        content: '몇 인분이 필요하신가요?',
        timestamp: new Date(),
        messageType: 'choice',
        options: ['1인분', '2인분', '3-4인분', '5인분 이상']
      };

      setMessages(prev => [...prev, aiResponse, nextQuestion]);
      setCurrentStep(1);
    } catch (error) {
      console.error('❌ Failed to save target:', error);
      // 에러 메시지 표시
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionSelect = async (option: string) => {
    // 사용자 선택 메시지 추가
    const userMessage: ChatMessage = {
      id: `user-option-${Date.now()}`,
      type: 'user',
      content: option,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 추가 질문 단계인지 확인
      const isAdditionalQuestionPhase = currentStep === 2 || conversationPhase === 'additional';
      
      if (isAdditionalQuestionPhase) {
        // 추가 질문 단계 처리
        if (option === '네, 질문이 있어요' || option === '네, 더 있어요') {
          const textInputMessage: ChatMessage = {
            id: `ai-text-input-${Date.now()}`,
            type: 'ai',
            content: '궁금한 점을 자유롭게 입력해주세요!',
            timestamp: new Date(),
            messageType: 'text_input'
          };
          setMessages(prev => [...prev, textInputMessage]);
          setShowTextInput(true);
          setConversationPhase('additional');
        } else if (option === '아니요, 충분해요' || option === '아니요, 이제 충분해요') {
          // 제출하기 단계로 (이미 서버에 데이터 저장되어 있음)
          setConversationPhase('complete');
          handleSubmitProfile();
          return;  // setIsLoading(false) 실행 방지
        } else if (currentStep === 2) {
          // Step 2에서 요리시간 선택 - 서버에 저장
          const currentSessionId = sessionId || localStorage.getItem('sessionId') || '';
          if (!currentSessionId) {
            console.error('Session not initialized');
            setIsLoading(false);
            return;
          }
          await ApiService.updateProfile(currentSessionId, { 
            target: selectedTarget,
            servings: getServingsFromMessages(),
            cookingTime: option 
          });
          console.log('✅ Cooking time saved to server:', option);

          // 추가 질문 보여주기
          const additionalQuestionMessage: ChatMessage = {
            id: `ai-additional-${Date.now()}`,
            type: 'ai',
            content: '추가로 궁금한 점이나 특별한 요청사항이 있으신가요?',
            timestamp: new Date(),
            messageType: 'choice',
            options: ['네, 질문이 있어요', '아니요, 충분해요']
          };
          setMessages(prev => [...prev, additionalQuestionMessage]);
          setConversationPhase('additional');
        }
      } else {
        // 기본 질문 단계 (currentStep 1: 인분 선택)
        if (currentStep === 1) {
          // 인분 선택 - 서버에 저장
          const currentSessionId = sessionId || localStorage.getItem('sessionId') || '';
          if (!currentSessionId) {
            console.error('Session not initialized');
            setIsLoading(false);
            return;
          }
          await ApiService.updateProfile(currentSessionId, { 
            target: selectedTarget,
            servings: option 
          });
          console.log('✅ Servings saved to server:', option);
        }

        const nextQuestion = getNextQuestion();
        const aiMessage: ChatMessage = {
          id: `ai-next-${Date.now()}`,
          type: 'ai',
          content: nextQuestion.question,
          timestamp: new Date(),
          messageType: 'choice',
          options: nextQuestion.options
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentStep(prev => prev + 1);
        
        // 마지막 기본 질문이었으면 추가 질문 단계로 전환
        if (currentStep === 1) {
          setConversationPhase('additional');
        }
      }
    } catch (error) {
      console.error('❌ Failed to save option:', error);
      // 에러 메시지 표시
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지에서 인분 정보 추출하는 헬퍼 함수
  const getServingsFromMessages = (): string => {
    const servingMessage = messages.find(m => 
      m.type === 'user' && m.content?.includes('인분')
    );
    return servingMessage?.content || '2인분';
  };

  const getNextQuestion = () => {
    const questions = [
      {
        question: '요리 시간은 얼마나 걸려도 괜찮으신가요?',
        options: ['10분 이내', '30분 이내', '1시간 이내', '시간 상관없음']
      },
      {
        question: '추가로 궁금한 점이나 특별한 요청사항이 있으신가요?',
        options: ['네, 질문이 있어요', '아니요, 충분해요']
      }
    ];
    return questions[currentStep - 1] || questions[0];
  };

  const handleCheckItem = (itemName: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }));
  };

  const calculateTotal = () => {
    if (!currentRecipe?.ingredients) return 0;
    
    return currentRecipe.ingredients
      .filter(ingredient => checkedItems[ingredient.name])
      .reduce((total, ingredient) => {
        if (ingredient.prices && ingredient.prices.length > 0) {
          const minPrice = Math.min(...ingredient.prices.map(p => p.price));
          return total + minPrice;
        } else if (ingredient.price) {
          return total + ingredient.price;
        }
        return total;
      }, 0);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR') + '원';
  };

  const generateRecipe = async () => {
    try {
      // 타겟별 하드코딩된 테스트 데이터
      let hardcodedRecipe;
      
      switch (selectedTarget) {
        case 'baby':
          hardcodedRecipe = {
            id: 'baby-chicken-pumpkin',
            name: '닭가슴살 단호박 이유식',
            description: '9-12개월 아기를 위한 영양만점 이유식입니다. 부드럽고 소화하기 쉬운 재료로 만든 건강한 한 끼입니다.',
            cookingTime: 20,
            difficulty: 'easy' as const,
            servings: 2,
            instructions: [
              '닭가슴살은 깨끗이 씻어 한 입 크기로 썰어주세요',
              '단호박은 껍질을 벗기고 작게 썰어주세요',
              '브로콜리는 꽃송이만 떼어 작게 썰어주세요',
              '물을 끓인 후 닭가슴살을 넣고 10분간 삶아주세요',
              '단호박과 브로콜리를 넣고 5분 더 삶아주세요',
              '모든 재료를 으깨서 아기가 먹기 좋은 크기로 만들어주세요'
            ],
            ingredients: [
              {
                name: '닭가슴살',
                amount: '50g',
                prices: [
                  { vendor: '이마트', price: 3500 },
                  { vendor: '쿠팡', price: 3200 },
                  { vendor: '마켓컬리', price: 3800 }
                ]
              },
              {
                name: '단호박',
                amount: '100g',
                prices: [
                  { vendor: '이마트', price: 2000 },
                  { vendor: '쿠팡', price: 1800 },
                  { vendor: '마켓컬리', price: 2200 }
                ]
              },
              {
                name: '브로콜리',
                amount: '30g',
                prices: [
                  { vendor: '이마트', price: 1500 },
                  { vendor: '쿠팡', price: 1300 },
                  { vendor: '마켓컬리', price: 1700 }
                ]
              }
            ],
            nutrition: {
              calories: 180,
              carbs: 15,
              protein: 18,
              fat: 3,
              carbsPercent: 33,
              proteinPercent: 40,
              fatPercent: 15
            },
            tags: ['이유식', '12개월', '영양균형'],
            totalPrice: 6300
          };
          break;
          
        case 'diabetes':
          hardcodedRecipe = {
            id: 'diabetes-brown-rice-vegetables',
            name: '현미 채소볶음',
            description: '혈당 관리에 도움되는 저GI 현미와 신선한 채소로 만든 건강한 볶음밥입니다.',
            cookingTime: 25,
            difficulty: 'easy' as const,
            servings: 2,
            instructions: [
              '현미는 미리 불려서 밥을 지어주세요',
              '브로콜리와 당근은 한 입 크기로 썰어주세요',
              '팬에 올리브오일을 두르고 당근을 먼저 볶아주세요',
              '브로콜리를 넣고 2분간 더 볶아주세요',
              '현미밥을 넣고 골고루 섞어가며 볶아주세요',
              '소금과 후추로 간을 맞춰 완성해주세요'
            ],
            ingredients: [
              {
                name: '현미',
                amount: '1컵',
                prices: [
                  { vendor: '이마트', price: 4500 },
                  { vendor: '쿠팡', price: 4200 },
                  { vendor: '마켓컬리', price: 4800 }
                ]
              },
              {
                name: '브로콜리',
                amount: '100g',
                prices: [
                  { vendor: '이마트', price: 2500 },
                  { vendor: '쿠팡', price: 2200 },
                  { vendor: '마켓컬리', price: 2800 }
                ]
              },
              {
                name: '당근',
                amount: '1개',
                prices: [
                  { vendor: '이마트', price: 1200 },
                  { vendor: '쿠팡', price: 1000 },
                  { vendor: '마켓컬리', price: 1400 }
                ]
              },
              {
                name: '올리브오일',
                amount: '1큰술',
                prices: [
                  { vendor: '이마트', price: 6800 },
                  { vendor: '쿠팡', price: 5900 },
                  { vendor: '마켓컬리', price: 7200 }
                ]
              }
            ],
            nutrition: {
              calories: 320,
              carbs: 45,
              protein: 12,
              fat: 8,
              carbsPercent: 56,
              proteinPercent: 15,
              fatPercent: 23
            },
            tags: ['당뇨식', '저GI', '고섬유', '혈당관리'],
            totalPrice: 15000
          };
          break;
          
        default: // keto
          hardcodedRecipe = {
            id: 'keto-shrimp-avocado',
            name: '케토 새우 아보카도 볶음',
            description: '저탄수화물 고지방 케톤 다이어트에 완벽한 새우 아보카도 요리입니다. 신선한 새우와 크리미한 아보카도의 조화가 일품입니다.',
            cookingTime: 15,
            difficulty: 'easy' as const,
            servings: 2,
            instructions: [
              '새우는 껍질을 벗기고 내장을 제거한 후 깨끗이 씻어주세요',
              '아보카도는 반으로 갈라 씨를 제거하고 한 입 크기로 썰어주세요',
              '팬에 버터를 두르고 중불에서 녹여주세요',
              '새우를 넣고 2-3분간 볶아 색이 변하면 뒤집어주세요',
              '아보카도를 넣고 1분간 가볍게 볶아주세요',
              '올리브오일을 뿌리고 소금, 후추로 간을 맞춰 완성해주세요'
            ],
            ingredients: [
              {
                name: '새우',
                amount: '200g',
                prices: [
                  { vendor: '이마트', price: 8900 },
                  { vendor: '쿠팡', price: 7500 },
                  { vendor: '마켓컬리', price: 8200 }
                ]
              },
              {
                name: '아보카도',
                amount: '1개',
                prices: [
                  { vendor: '이마트', price: 2500 },
                  { vendor: '쿠팡', price: 2200 },
                  { vendor: '마켓컬리', price: 2800 }
                ]
              },
              {
                name: '버터',
                amount: '20g',
                prices: [
                  { vendor: '이마트', price: 4500 },
                  { vendor: '쿠팡', price: 3900 },
                  { vendor: '마켓컬리', price: 4200 }
                ]
              },
              {
                name: '올리브오일',
                amount: '1큰술',
                prices: [
                  { vendor: '이마트', price: 6800 },
                  { vendor: '쿠팡', price: 5900 },
                  { vendor: '마켓컬리', price: 7200 }
                ]
              },
              {
                name: '소금',
                amount: '약간',
                prices: [
                  { vendor: '이마트', price: 1200 },
                  { vendor: '쿠팡', price: 1000 },
                  { vendor: '마켓컬리', price: 1500 }
                ]
              }
            ],
            nutrition: {
              calories: 420,
              carbs: 8,
              protein: 25,
              fat: 35,
              carbsPercent: 7,
              proteinPercent: 23,
              fatPercent: 70
            },
            tags: ['케토', '고지방', '저탄수화물', '오메가3'],
            totalPrice: 23400
          };
      }

      setCurrentRecipe(hardcodedRecipe);
      
      // 모든 재료를 기본적으로 체크된 상태로 설정
      const initialCheckedItems: {[key: string]: boolean} = {};
      hardcodedRecipe.ingredients.forEach(ingredient => {
        initialCheckedItems[ingredient.name] = true;
      });
      setCheckedItems(initialCheckedItems);
      
      setShowResult(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
    }
  };

  const handleTextInput = async (inputText: string) => {
    // 사용자 입력 메시지 추가
    const userMessage: ChatMessage = {
      id: `user-text-${Date.now()}`,
      type: 'user',
      content: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setAdditionalQuestions(prev => [...prev, inputText]);
    setShowTextInput(false);
    setIsLoading(true);

    try {
      // 현재 프로필 정보 구성
      const profileData = {
        target: selectedTarget,
        servings: getServingsFromMessages(),
        cookingTime: getCookingTimeFromMessages()
      };

      // ApiService를 통해 Bedrock 분석 요청
      const currentSessionId = sessionId || localStorage.getItem('sessionId') || '';
      if (!currentSessionId) {
        console.error('Session not initialized');
        setIsLoading(false);
        setShowTextInput(true);
        return;
      }
      const response = await ApiService.updateProfile(currentSessionId, profileData, inputText);
      console.log('✅ Additional info processed:', response);

      // NON_FOOD_RELATED_PROMPT 응답 처리
      if (response.isNonFoodPrompt) {
        console.log('ℹ️ 음식 관련 내용이 아닙니다');
        const guidanceMessage: ChatMessage = {
          id: `ai-guidance-${Date.now()}`,
          type: 'ai',
          content: '음식이나 요리와 관련된 내용을 입력해주세요! 예를 들어 알레르기, 선호하는 맛, 싫어하는 음식, 건강 상태 등을 알려주시면 더 맞춤형 레시피를 추천해드릴 수 있어요. 😊',
          timestamp: new Date(),
          messageType: 'choice',
          options: ['네, 더 있어요', '아니요, 이제 충분해요']
        };
        setMessages(prev => [...prev, guidanceMessage]);
        setShowTextInput(true);
        return;
      }

      // AI 응답 메시지 추가
      const aiResponse: ChatMessage = {
        id: `ai-response-${Date.now()}`,
        type: 'ai',
        content: '네, 알겠습니다! 말씀해주신 내용을 반영해서 레시피를 준비하겠습니다.',
        timestamp: new Date()
      };

      // 다시 추가 질문 물어보기
      const nextQuestion: ChatMessage = {
        id: `ai-additional-${Date.now()}`,
        type: 'ai',
        content: '또 다른 질문이나 요청사항이 있으신가요?',
        timestamp: new Date(),
        messageType: 'choice',
        options: ['네, 더 있어요', '아니요, 이제 충분해요']
      };

      setMessages(prev => [...prev, aiResponse, nextQuestion]);
    } catch (error) {
      console.error('❌ Additional question processing failed:', error);
      
      // 에러 시 fallback 응답
      const errorMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        content: '죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 메시지에서 요리시간 정보 추출하는 헬퍼 함수
  const getCookingTimeFromMessages = (): string => {
    const timeMessage = messages.find(m => 
      m.type === 'user' && (m.content?.includes('분') || m.content?.includes('시간'))
    );
    return timeMessage?.content || '30분 이내';
  };

  // 입력에 따른 맞춤 응답 생성 (임시)
  const getContextualResponse = (input: string): string => {
    if (input.includes('매운') || input.includes('매워')) {
      return '매운 음식을 싫어하시는군요! 담백하고 부드러운 맛의 레시피로 준비하겠습니다. 🍳';
    } else if (input.includes('알러지') || input.includes('알레르기')) {
      return '알레르기 정보 감사합니다! 해당 재료를 제외하고 안전한 레시피를 추천해드릴게요. 🌿';
    } else if (input.includes('채소') || input.includes('야채')) {
      return '채소 관련 요청사항을 확인했습니다! 신선한 채소를 활용한 건강한 레시피로 구성하겠습니다. 🥗';
    } else {
      return '네, 알겠습니다! 말씀해주신 내용을 레시피에 반영하겠어요. 👨‍🍳';
    }
  };

  const handleSubmitProfile = async () => {
    const submitMessage: ChatMessage = {
      id: `ai-submit-${Date.now()}`,
      type: 'ai',
      content: '대화를 마쳤어요! 맞춤 레시피를 생성하고 최저가 정보를 찾을게요. 잠시만 기다려주세요!',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, submitMessage]);
    setIsLoading(true);
    
    try {
      // Phase 3 - 백엔드로 레시피 생성 요청
      const currentSessionId = sessionId || localStorage.getItem('sessionId') || '';
      if (!currentSessionId) {
        console.error('Session not initialized');
        setIsLoading(false);
        return;
      }
      console.log('🍳 Starting recipe processing for session:', currentSessionId);
      const response = await ApiService.processRecipe(currentSessionId);
      console.log('✅ Recipe processing started:', response);
      
      // 로딩 화면으로 즉시 전환 (폴링은 ResultModal에서 처리)
      setShowResult(true);
      
    } catch (error) {
      console.error('❌ Recipe processing failed:', error);
      setIsLoading(false);
      
      // 에러 메시지 표시
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: '죄송합니다. 레시피 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };
  const getTargetResponseMessage = (target: UserTarget): string => {
    const messages = {
      keto: '케톤 다이어트를 선택하셨네요! 🥑\n저탄고지 레시피를 추천해드릴게요.',
      baby: '이유식을 선택하셨네요! 👶\n아기의 건강한 성장을 도와드릴게요.',
      diabetes: '당뇨 관리식을 선택하셨네요! 💉\n혈당 관리에 도움되는 레시피를 추천해드릴게요.',
      general: '일반 식단을 선택하셨네요! 🍽️\n건강하고 맛있는 레시피를 추천해드릴게요.',
      fridge: '냉장고 파먹기를 선택하셨네요! 🧊\n냉장고 속 재료로 창의적인 요리를 만들어보세요.'
    };
    return messages[target];
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      {/* 로딩 화면 */}
      {showResult && isLoading && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <div className="absolute inset-0 border-4 border-orange-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">맞춤 레시피 생성 중...</h2>
              <p className="text-gray-600">AI가 최적의 레시피와 최저가 정보를 찾고 있어요</p>
            </div>
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      )}

      {/* 레시피 결과 화면 */}
      {showResult && !isLoading && currentRecipe && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">{currentRecipe.name}</h2>
            
            {/* 탭 버튼들 */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab('recipe')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${
                  activeTab === 'recipe'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center">
                  📜 <span className="ml-2">레시피</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('shopping')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${
                  activeTab === 'shopping'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center">
                  🛒 <span className="ml-2">장보기</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('nutrition')}
                className={`flex-1 py-3 px-4 text-center font-medium transition-colors relative ${
                  activeTab === 'nutrition'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center">
                  📊 <span className="ml-2">영양정보</span>
                </span>
              </button>
            </div>

            {/* 탭 내용 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              {activeTab === 'recipe' && (
                <div>
                  {/* 요리 이미지 플레이스홀더 */}
                  <div className="w-full h-48 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center mb-6">
                    <span className="text-orange-600 font-medium">요리 이미지</span>
                  </div>

                  {/* 레시피 설명 */}
                  <p className="text-gray-600 mb-6">{currentRecipe.description}</p>

                  {/* 기본 정보 */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">조리시간</p>
                      <p className="text-lg font-semibold text-orange-600">{currentRecipe.cookingTime}분</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">칼로리</p>
                      <p className="text-lg font-semibold text-orange-600">{currentRecipe.nutrition?.calories}kcal</p>
                    </div>
                  </div>

                  {/* 타겟별 특화 정보 */}
                  {selectedTarget && (
                    <div className="mb-6">
                      {selectedTarget === 'keto' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-xl mr-2">🥑</span>
                            <h4 className="font-semibold text-purple-800">케토 정보</h4>
                          </div>
                          <p className="text-purple-700 mb-2">순 탄수화물: 5g</p>
                          <p className="text-sm text-purple-600">💡 케톤 적응기에는 전해질 보충이 중요해요!</p>
                        </div>
                      )}
                      
                      {selectedTarget === 'baby' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-xl mr-2">👶</span>
                            <h4 className="font-semibold text-blue-800">이유식 정보</h4>
                          </div>
                          <p className="text-blue-700 mb-2">권장 월령: 9-12개월</p>
                          <p className="text-sm text-blue-600">💡 아기가 삼키기 쉽도록 충분히 으깨주세요!</p>
                        </div>
                      )}
                      
                      {selectedTarget === 'diabetes' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-xl mr-2">💉</span>
                            <h4 className="font-semibold text-green-800">당뇨 관리 정보</h4>
                          </div>
                          <p className="text-green-700 mb-2">GI 지수: 45 (낮음)</p>
                          <p className="text-sm text-green-600">💡 식후 혈당 측정을 권장해요!</p>
                        </div>
                      )}
                      
                      {selectedTarget === 'general' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-xl mr-2">🍽️</span>
                            <h4 className="font-semibold text-orange-800">건강 정보</h4>
                          </div>
                          <p className="text-orange-700 mb-2">균형잡힌 영양소 구성</p>
                          <p className="text-sm text-orange-600">💡 규칙적인 식사가 건강의 기본이에요!</p>
                        </div>
                      )}
                      
                      {selectedTarget === 'fridge' && (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                          <div className="flex items-center mb-2">
                            <span className="text-xl mr-2">🧊</span>
                            <h4 className="font-semibold text-teal-800">냉장고 활용 정보</h4>
                          </div>
                          <p className="text-teal-700 mb-2">재료 활용도: 95%</p>
                          <p className="text-sm text-teal-600">💡 남은 재료로 다른 요리도 만들어보세요!</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 조리 방법 */}
                  {currentRecipe.instructions && currentRecipe.instructions.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-4">조리 방법</h4>
                      <div className="space-y-4">
                        {currentRecipe.instructions.map((instruction, index) => (
                          <div key={index} className="flex items-start relative">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-4 relative z-10">
                              {index + 1}
                            </div>
                            {index < currentRecipe.instructions.length - 1 && (
                              <div className="absolute left-4 top-8 w-px h-8 bg-gray-300"></div>
                            )}
                            <div className="flex-1">
                              <p className="text-gray-700">{instruction}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'shopping' && (
                <div>
                  {currentRecipe?.ingredients ? (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800 mb-4">필요한 재료</h4>
                      
                      {currentRecipe.ingredients.map((ingredient, index) => {
                        const minPrice = ingredient.prices && ingredient.prices.length > 0 
                          ? Math.min(...ingredient.prices.map(p => p.price))
                          : ingredient.price || 0;
                        const isChecked = checkedItems[ingredient.name] || false;
                        
                        return (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start mb-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCheckItem(ingredient.name)}
                                className="mt-1 mr-3 w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                              />
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-800">{ingredient.name}</h5>
                                <p className="text-sm text-gray-600">{ingredient.amount}</p>
                              </div>
                            </div>
                            
                            <div className="ml-7 space-y-2">
                              {ingredient.prices && ingredient.prices.length > 0 ? (
                                ingredient.prices.map((priceInfo, priceIndex) => (
                                  <div key={priceIndex} className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">{priceInfo.vendor}</span>
                                    <div className="flex items-center">
                                      <span className={`font-medium ${
                                        priceInfo.price === minPrice 
                                          ? 'text-orange-600' 
                                          : 'text-gray-500'
                                      }`}>
                                        {formatPrice(priceInfo.price)}
                                      </span>
                                      {priceInfo.price === minPrice && (
                                        <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full">
                                          👑 최저가
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : ingredient.price ? (
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-gray-600">{ingredient.store || '온라인'}</span>
                                  <span className="text-sm font-medium text-orange-600">
                                    {formatPrice(ingredient.price)}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500">가격 정보 없음</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">재료 정보를 불러오는 중...</p>
                    </div>
                  )}
                  
                  {/* 고정된 하단 총액 표시 */}
                  <div className="sticky bottom-0 z-10 bg-white border-t border-gray-200 p-4 shadow-lg">
                    <div className="max-w-2xl mx-auto flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">
                          선택한 재료 ({Object.values(checkedItems).filter(Boolean).length}/{currentRecipe?.ingredients?.length || 0}개)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-600">
                          예상 금액: {formatPrice(calculateTotal())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'nutrition' && (
                <div>
                  {currentRecipe?.nutrition ? (
                    <div className="space-y-6">
                      {/* 영양 성분 박스 */}
                      <div className="border border-gray-200 rounded-lg p-6 bg-white">
                        <h4 className="font-semibold text-gray-800 mb-4">영양 성분</h4>
                        
                        {/* 칼로리 */}
                        <div className="text-center mb-6">
                          <span className="text-3xl font-bold text-orange-600">{currentRecipe.nutrition.calories}</span>
                          <span className="text-lg text-gray-600 ml-2">kcal</span>
                        </div>

                        {/* 영양소 막대 그래프 */}
                        <div className="space-y-4">
                          {/* 탄수화물 */}
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">탄수화물</span>
                              <span className="text-sm text-gray-600">{currentRecipe.nutrition.carbs}g</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${(currentRecipe.nutrition.carbs / (currentRecipe.nutrition.carbs + currentRecipe.nutrition.protein + currentRecipe.nutrition.fat) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>

                          {/* 단백질 */}
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">단백질</span>
                              <span className="text-sm text-gray-600">{currentRecipe.nutrition.protein}g</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-red-500 h-3 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${(currentRecipe.nutrition.protein / (currentRecipe.nutrition.carbs + currentRecipe.nutrition.protein + currentRecipe.nutrition.fat) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>

                          {/* 지방 */}
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">지방</span>
                              <span className="text-sm text-gray-600">{currentRecipe.nutrition.fat}g</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div 
                                className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${(currentRecipe.nutrition.fat / (currentRecipe.nutrition.carbs + currentRecipe.nutrition.protein + currentRecipe.nutrition.fat) * 100)}%` 
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 케톤 매크로 비율 (케토 타겟일 때만) */}
                      {selectedTarget === 'keto' && currentRecipe.nutrition.carbsPercent && (
                        <div className="border border-gray-200 rounded-lg p-6 bg-white">
                          <h4 className="font-semibold text-gray-800 mb-4">케톤 매크로 비율</h4>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold text-blue-500 mb-1">
                                {currentRecipe.nutrition.carbsPercent}%
                              </div>
                              <div className="text-sm text-gray-600">탄수화물</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-red-500 mb-1">
                                {currentRecipe.nutrition.proteinPercent}%
                              </div>
                              <div className="text-sm text-gray-600">단백질</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-yellow-500 mb-1">
                                {currentRecipe.nutrition.fatPercent}%
                              </div>
                              <div className="text-sm text-gray-600">지방</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">영양 정보를 불러오는 중...</p>
                    </div>
                  )}
                </div>
              )}

              <button 
                onClick={() => {
                  setShowResult(false);
                  setCurrentRecipe(null);
                  setMessages([]);
                  setSelectedTarget(null);
                  setCurrentStep(0);
                  setAdditionalQuestions([]);
                  setConversationPhase('basic');
                  setActiveTab('recipe');
                  setCheckedItems({});
                }}
                className="w-full py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors mt-6"
              >
                새로운 레시피 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 채팅 화면 */}
      {!showResult && (
        <>
          {/* 헤더 */}
          <div className="p-4 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-center mb-3">
          <ChefHat className="w-5 h-5 text-orange-500 mr-2" />
          <h1 className="text-lg font-semibold text-gray-800">AI 셰프 어시스턴트</h1>
        </div>
        <div className="flex justify-center space-x-2">
          {[0, 1, 2].map((step) => (
            <div
              key={step}
              className={`w-16 h-1 rounded-full ${
                step <= currentStep ? 'bg-orange-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-scroll-container>
        {messages.map((message, index) => (
          <div key={message.id}>
            <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-orange-500 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              } shadow-sm`}>
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-gray-100 text-gray-800 rounded-bl-sm shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-sm">입력 중</span>
                <div className="typing-dots flex space-x-1">
                  <span className="w-2 h-2 bg-gray-600 rounded-full inline-block"></span>
                  <span className="w-2 h-2 bg-gray-600 rounded-full inline-block"></span>
                  <span className="w-2 h-2 bg-gray-600 rounded-full inline-block"></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 타겟 선택 버튼들 */}
        {!selectedTarget && !isLoading && (
          <div className="flex justify-start ml-2">
            <div className="w-full">
              <div className="grid grid-cols-2 gap-2">
                {targetInfos.map((target) => (
                  <button
                    key={target.id}
                    onClick={() => handleTargetSelect(target.id)}
                    className="py-3 px-4 rounded-lg bg-gradient-to-r from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 shadow-md hover:shadow-xl ring-1 ring-gray-200 hover:ring-orange-300 transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mr-3">
                        <span className="text-lg">{target.icon}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800">{target.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 옵션 선택 버튼들 */}
        {shouldShowOptions && !isLoading && (
          <div className="flex justify-start ml-2">
            <div className="w-full">
              <div className="grid grid-cols-2 gap-2">
                {lastMessage?.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(option)}
                    className="py-3 px-4 rounded-lg bg-gradient-to-r from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 shadow-md hover:shadow-xl ring-1 ring-gray-200 hover:ring-orange-300 transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    <span className="text-xs font-bold text-gray-800">{option}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 자동 스크롤을 위한 요소 */}
        <div ref={messagesEndRef} />

        {/* 텍스트 입력 UI */}
        {shouldShowTextInput && !isLoading && (
          <div className="flex justify-start ml-2">
            <div className="w-full">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <textarea
                  placeholder="궁금한 점이나 특별한 요청사항을 입력해주세요..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const text = e.currentTarget.value.trim();
                      if (text) {
                        handleTextInput(text);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <div className="flex justify-end mt-2 space-x-2">
                  <button
                    onClick={() => {
                      const textarea = document.querySelector('textarea');
                      const text = textarea?.value.trim();
                      if (text && textarea) {
                        handleTextInput(text);
                        textarea.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-200 text-sm font-medium"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
