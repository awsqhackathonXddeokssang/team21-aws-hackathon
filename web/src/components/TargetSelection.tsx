'use client';

import { useState } from 'react';
import { UserTarget } from '@/types';
import { targetInfos } from '@/lib/mockData';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface TargetSelectionProps {
  onTargetSelect: (target: UserTarget) => void;
}

export default function TargetSelection({ onTargetSelect }: TargetSelectionProps) {
  const [selectedTarget, setSelectedTarget] = useState<UserTarget | null>(null);

  const handleContinue = () => {
    if (selectedTarget) {
      onTargetSelect(selectedTarget);
    }
  };

  const getCardColor = (targetId: UserTarget) => {
    const colors = {
      keto: 'border-emerald-200 hover:border-emerald-400 bg-gradient-to-br from-emerald-50 to-emerald-100',
      baby: 'border-pink-200 hover:border-pink-400 bg-gradient-to-br from-pink-50 to-pink-100',
      diabetes: 'border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100',
      general: 'border-gray-200 hover:border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100',
      fridge: 'border-orange-200 hover:border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100'
    };
    return colors[targetId];
  };

  const getSelectedColor = (targetId: UserTarget) => {
    const colors = {
      keto: 'ring-emerald-500 border-emerald-500 bg-gradient-to-br from-emerald-100 to-emerald-200',
      baby: 'ring-pink-500 border-pink-500 bg-gradient-to-br from-pink-100 to-pink-200',
      diabetes: 'ring-blue-500 border-blue-500 bg-gradient-to-br from-blue-100 to-blue-200',
      general: 'ring-gray-500 border-gray-500 bg-gradient-to-br from-gray-100 to-gray-200',
      fridge: 'ring-orange-500 border-orange-500 bg-gradient-to-br from-orange-100 to-orange-200'
    };
    return colors[targetId];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            어떤 요리를 도와드릴까요?
          </h1>
          <p className="text-gray-600">
            맞춤형 레시피를 위해 선택해주세요
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {targetInfos.map((target) => {
            const isSelected = selectedTarget === target.id;
            
            return (
              <button
                key={target.id}
                onClick={() => setSelectedTarget(target.id)}
                className={clsx(
                  "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left",
                  isSelected 
                    ? `ring-2 ${getSelectedColor(target.id)}`
                    : getCardColor(target.id)
                )}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{target.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-800">{target.name}</h3>
                    <p className="text-sm text-gray-600">{target.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedTarget && (
          <button
            onClick={handleContinue}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center"
          >
            시작하기
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
