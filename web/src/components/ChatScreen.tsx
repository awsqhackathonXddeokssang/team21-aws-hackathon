'use client';

import { useState, useEffect } from 'react';
import { UserTarget, ChatMessage, Recipe } from '@/types';
import { targetInfos } from '@/lib/mockData';
import { Loader2, ChefHat } from 'lucide-react';
import ResultModal from './ResultModal';
import { MockApiService } from '@/lib/mockApi';

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

  // 마지막 메시지 기반 선택지 표시 로직
  const lastMessage = messages[messages.length - 1];
  const shouldShowOptions = lastMessage?.messageType === 'choice' && lastMessage?.options;
  const shouldShowTextInput = lastMessage?.messageType === 'text_input';

  // 세션 초기화
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // 기존 세션 확인
        const savedSessionId = localStorage.getItem('sessionId');
        const sessionExpiry = localStorage.getItem('sessionExpiry');
        
        if (savedSessionId && sessionExpiry && new Date(sessionExpiry) > new Date()) {
          // 유효한 세션 존재
          setSessionId(savedSessionId);
          console.log('Existing session restored:', savedSessionId);
        } else {
          // 새 세션 생성
          const sessionData = await MockApiService.startSession();
          setSessionId(sessionData.sessionId);
          localStorage.setItem('sessionId', sessionData.sessionId);
          localStorage.setItem('sessionExpiry', sessionData.expiresAt);
          console.log('New session created:', sessionData.sessionId);
        }
      } catch (error) {
        console.error('세션 초기화 실패:', error);
        // Fallback: 임시 세션 ID 생성
        const fallbackId = `temp-${Date.now()}`;
        setSessionId(fallbackId);
        console.log('Fallback session created:', fallbackId);
      }
    };
    
    initializeSession();
  }, []);

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

    setTimeout(() => {
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
      setIsLoading(false);
    }, 1000);
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

    setTimeout(() => {
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
          // 제출하기 단계로
          setConversationPhase('complete');
          handleSubmitProfile();
        } else if (currentStep === 2) {
          // Step 2에서 일반 옵션 선택 시 추가 질문 보여주기
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
        setIsLoading(false);
      } else {
        // 기본 질문 단계 (currentStep 0, 1)
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
        setIsLoading(false);
      }
    }, 1000);
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
        const minPrice = Math.min(...ingredient.prices.map(p => p.price));
        return total + minPrice;
      }, 0);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ko-KR') + '원';
  };

  const generateRecipe = async () => {
    try {
      const recipe = await MockApiService.generateRecipe(selectedTarget!, '맞춤 레시피');
      setCurrentRecipe(recipe);
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
        servings: messages.find(m => m.content?.includes('인분'))?.content || '2인분',
        cookingTime: messages.find(m => m.content?.includes('분'))?.content || '30분',
        additionalQuestions
      };

      // Mock Bedrock API 호출 (sessionId 포함)
      const response = await MockApiService.processAdditionalQuestion(
        inputText, 
        sessionId, 
        profileData
      );

      // AI 응답 메시지 추가
      const aiResponse: ChatMessage = {
        id: `ai-response-${Date.now()}`,
        type: 'ai',
        content: response.response,
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
      setIsLoading(false);
    } catch (error) {
      console.error('추가 질문 처리 오류:', error);
      setIsLoading(false);
      
      // 에러 시 fallback 응답
      const errorMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        content: '죄송해요, 일시적인 오류가 발생했어요. 다시 시도해주세요.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
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
    
    // 프로필 데이터 구성
    const profileData = {
      target: selectedTarget,
      servings: messages.find(m => m.content?.includes('인분'))?.content || '2인분',
      cookingTime: messages.find(m => m.content?.includes('분'))?.content || '30분',
      additionalQuestions,
      conversationHistory: messages.map(m => ({
        role: m.type,
        content: m.content
      }))
    };

    try {
      // TODO: 실제 서버 통신으로 교체
      // const response = await fetch('/api/process', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     sessionId,
      //     profile: profileData
      //   })
      // });
      // const { executionId } = await response.json();
      
      // // 폴링 시작 (3초마다 상태 확인)
      // const pollInterval = setInterval(async () => {
      //   const statusResponse = await fetch(`/api/status/${executionId}`);
      //   const { status, result } = await statusResponse.json();
      //   
      //   if (status === 'completed') {
      //     clearInterval(pollInterval);
      //     setCurrentRecipe(result.recipe);
      //     setShowResult(true);
      //     setIsLoading(false);
      //   }
      // }, 3000);

      // Mock 처리 (실제로는 위의 폴링으로 대체)
      // 로딩 화면으로 즉시 전환
      setShowResult(true);
      
      setTimeout(async () => {
        const recipe = await MockApiService.generateRecipe(selectedTarget!, '맞춤 레시피');
        setCurrentRecipe(recipe);
        setIsLoading(false);
      }, 5000); // 5초 로딩 시뮬레이션
      
    } catch (error) {
      console.error('Error submitting profile:', error);
      setIsLoading(false);
      
      const errorMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        content: '레시피 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
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
    <div className="h-full bg-white flex flex-col">
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
                      <p className="text-lg font-semibold text-orange-600">{currentRecipe.cookingTime}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600">칼로리</p>
                      <p className="text-lg font-semibold text-orange-600">{currentRecipe.calories}kcal</p>
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
                  {currentRecipe.steps && currentRecipe.steps.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-800 mb-4">조리 방법</h4>
                      <div className="space-y-4">
                        {currentRecipe.steps.map((step, index) => (
                          <div key={index} className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-semibold mr-4">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700">{step}</p>
                              {index < currentRecipe.steps.length - 1 && (
                                <div className="w-px h-4 bg-gray-300 ml-4 mt-2"></div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'shopping' && (
                <div className="pb-20">
                  {currentRecipe?.ingredients ? (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-800 mb-4">필요한 재료</h4>
                      
                      {currentRecipe.ingredients.map((ingredient, index) => {
                        const minPrice = Math.min(...ingredient.prices.map(p => p.price));
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
                              {ingredient.prices.map((priceInfo, priceIndex) => (
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
                              ))}
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
                  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
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
                <div className="text-center py-8">
                  <p className="text-gray-500">영양 정보가 여기 표시됩니다</p>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      if (text) {
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
