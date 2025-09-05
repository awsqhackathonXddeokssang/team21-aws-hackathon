'use client';

import { useState } from 'react';
import { UserTarget } from '@/types';
import { targetInfos } from '@/lib/mockData';

interface TargetSelectorProps {
  onTargetSelect: (target: UserTarget) => void;
}

export default function TargetSelector({ onTargetSelect }: TargetSelectorProps) {
  const [selectedTarget, setSelectedTarget] = useState<UserTarget | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleCardClick = (target: UserTarget) => {
    setSelectedTarget(target);
    setIsTransitioning(true);
    
    setTimeout(() => {
      onTargetSelect(target);
    }, 300);
  };

  return (
    <div className="h-full bg-gradient-to-br from-orange-50 to-emerald-50 p-4 flex flex-col">
      {/* AI 셰프 프로필 */}
      <div className="flex items-center mb-4 px-2">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full flex items-center justify-center shadow-md">
          <span className="text-white text-lg">👨‍🍳</span>
        </div>
        <div className="ml-3">
          <h2 className="font-semibold text-gray-800 text-sm">AI 셰프</h2>
          <p className="text-xs text-gray-500">온라인</p>
        </div>
      </div>

      {/* AI 메시지 말풍선들 */}
      <div className="mb-6 space-y-3">
        {/* 첫 번째 말풍선 */}
        <div className="bg-white rounded-2xl rounded-tl-md shadow-sm border border-gray-100 p-4 relative">
          <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white border-b-8 border-b-transparent"></div>
          <p className="text-sm text-gray-700 leading-relaxed">
            안녕하세요! AI 셰프입니다 👨‍🍳<br/>
            맞춤형 레시피를 추천해드릴게요.<br/>
            먼저 몇 가지 여쭤볼게요!
          </p>
        </div>

        {/* 두 번째 말풍선 */}
        <div className="bg-white rounded-2xl rounded-tl-md shadow-sm border border-gray-100 p-4 relative ml-4">
          <div className="absolute -left-2 top-4 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-white border-b-8 border-b-transparent"></div>
          <p className="text-sm font-medium text-gray-800">
            어떤 식단을 하고 계신가요?
          </p>
        </div>
      </div>

      {/* 선택 옵션들 */}
      <div className="flex-1 grid grid-cols-2 gap-2">
        {targetInfos.map((target) => (
          <button
            key={target.id}
            onClick={() => handleCardClick(target.id)}
            className={`py-3 px-3 rounded-xl border transition-all duration-200 text-left active:scale-95 ${
              selectedTarget === target.id && isTransitioning
                ? 'scale-105 bg-orange-100 border-orange-300 shadow-lg'
                : 'bg-white/80 border-white/50 hover:bg-white hover:border-orange-200 hover:shadow-md'
            } ${
              isTransitioning && selectedTarget !== target.id
                ? 'opacity-50 scale-95'
                : ''
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <span className="text-2xl mb-1">{target.icon}</span>
              <span className="text-sm font-medium text-gray-800">{target.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
