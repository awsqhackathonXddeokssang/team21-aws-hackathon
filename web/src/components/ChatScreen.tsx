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
  const [showTargetSelection, setShowTargetSelection] = useState(true);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);

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
    setShowTargetSelection(false);
    
    const targetInfo = targetInfos.find(t => t.id === target);
    
    // 사용자 선택 메시지 추가
    const userMessage: ChatMessage = {
      id: `user-target-${Date.now()}`,
      type: 'user',
      content: `${targetInfo?.icon} ${targetInfo?.name}`,
      timestamp: new Date()
    };

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
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage, aiResponse, nextQuestion]);
    setCurrentOptions(['1인분', '2인분', '3-4인분', '5인분 이상']);
    setCurrentStep(1);
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
    setCurrentOptions([]);
    setIsLoading(true);

    setTimeout(() => {
      if (currentStep >= 2) {
        // 레시피 생성
        generateRecipe();
      } else {
        // 다음 질문
        const nextQuestion = getNextQuestion();
        const aiMessage: ChatMessage = {
          id: `ai-next-${Date.now()}`,
          type: 'ai',
          content: nextQuestion.question,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
        setCurrentOptions(nextQuestion.options);
        setCurrentStep(prev => prev + 1);
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
        question: '어떤 맛을 선호하시나요?',
        options: ['담백한 맛', '매콤한 맛', '달콤한 맛', '진한 맛']
      }
    ];
    return questions[currentStep - 1] || questions[0];
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

        {/* 타겟 선택 버튼들 */}
        {showTargetSelection && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
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
                      <span className="text-sm font-bold text-gray-800">{target.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 옵션 선택 버튼들 */}
        {currentOptions.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%]">
              <div className="grid grid-cols-2 gap-2">
                {currentOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(option)}
                    className="py-3 px-4 rounded-lg bg-gradient-to-r from-white to-gray-50 hover:from-orange-50 hover:to-orange-100 shadow-md hover:shadow-xl ring-1 ring-gray-200 hover:ring-orange-300 transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    <span className="text-sm font-bold text-gray-800">{option}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
