'use client';

import { Recipe, UserTarget } from '@/types';
import { X, Clock, Users, ChefHat, ExternalLink, RefreshCw, Heart, Share2 } from 'lucide-react';
import clsx from 'clsx';

interface ResultModalProps {
  recipe: Recipe;
  target: UserTarget;
  onClose: () => void;
  onNewRecipe: () => void;
}

export default function ResultModal({ recipe, target, onClose, onNewRecipe }: ResultModalProps) {
  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      easy: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      hard: 'text-red-600 bg-red-100'
    };
    return colors[difficulty as keyof typeof colors] || colors.easy;
  };

  const getDifficultyText = (difficulty: string) => {
    const texts = {
      easy: '쉬움',
      medium: '보통',
      hard: '어려움'
    };
    return texts[difficulty as keyof typeof texts] || '쉬움';
  };

  const getTargetSpecificInfo = () => {
    if (!recipe.targetSpecific) return null;

    if (target === 'keto' && recipe.targetSpecific.keto) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <h4 className="font-semibold text-emerald-800 mb-2">🥑 케토 정보</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-emerald-700">순 탄수화물:</span>
              <span className="font-semibold ml-1">{recipe.targetSpecific.keto.netCarbs}g</span>
            </div>
            <div>
              <span className="text-emerald-700">케토 비율:</span>
              <span className="font-semibold ml-1">{recipe.targetSpecific.keto.ketogenicRatio}:1</span>
            </div>
          </div>
        </div>
      );
    }

    if (target === 'baby' && recipe.targetSpecific.baby) {
      return (
        <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
          <h4 className="font-semibold text-pink-800 mb-2">👶 이유식 정보</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-pink-700">적정 월령:</span>
              <span className="font-semibold ml-1">{recipe.targetSpecific.baby.ageRange}</span>
            </div>
            <div>
              <span className="text-pink-700">식감:</span>
              <span className="font-semibold ml-1">{recipe.targetSpecific.baby.texture}</span>
            </div>
            <div>
              <span className="text-pink-700">알레르기:</span>
              <span className="font-semibold ml-1">
                {recipe.targetSpecific.baby.allergens.length > 0 
                  ? recipe.targetSpecific.baby.allergens.join(', ')
                  : '없음'
                }
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (target === 'diabetes' && recipe.targetSpecific.diabetes) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">💉 당뇨 관리 정보</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">GI 지수:</span>
              <span className="font-semibold ml-1">{recipe.targetSpecific.diabetes.glycemicIndex}</span>
            </div>
            <div>
              <span className="text-blue-700">혈당 영향:</span>
              <span className={clsx(
                "font-semibold ml-1",
                recipe.targetSpecific.diabetes.bloodSugarImpact === 'low' ? 'text-green-600' :
                recipe.targetSpecific.diabetes.bloodSugarImpact === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              )}>
                {recipe.targetSpecific.diabetes.bloodSugarImpact === 'low' ? '낮음' :
                 recipe.targetSpecific.diabetes.bloodSugarImpact === 'medium' ? '보통' : '높음'}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{recipe.name}</h2>
              <p className="text-gray-600 mt-1">{recipe.description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{recipe.cookingTime}분</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Users className="w-4 h-4 text-gray-500" />
              <span>{recipe.servings}인분</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <ChefHat className="w-4 h-4 text-gray-500" />
              <span className={clsx(
                "px-2 py-1 rounded-full text-xs font-medium",
                getDifficultyColor(recipe.difficulty)
              )}>
                {getDifficultyText(recipe.difficulty)}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">총 가격:</span>
              <span className="font-bold text-emerald-600 ml-1">
                {recipe.totalPrice.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 타겟별 특화 정보 */}
          {getTargetSpecificInfo()}

          {/* 영양 정보 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-3">📊 영양 정보 (1인분)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-lg text-gray-800">{recipe.nutrition.calories}</div>
                <div className="text-gray-600">칼로리</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-gray-800">{recipe.nutrition.carbs}g</div>
                <div className="text-gray-600">탄수화물</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-gray-800">{recipe.nutrition.protein}g</div>
                <div className="text-gray-600">단백질</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-gray-800">{recipe.nutrition.fat}g</div>
                <div className="text-gray-600">지방</div>
              </div>
            </div>
          </div>

          {/* 재료 및 가격 */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">🛒 재료 및 가격</h4>
            <div className="space-y-3">
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="ingredient-item">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {ingredient.name} {ingredient.amount}{ingredient.unit}
                    </div>
                    <div className="text-sm text-gray-500">{ingredient.store}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="price-badge">
                      {ingredient.price ? ingredient.price.toLocaleString() : '0'}원
                    </span>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 조리법 */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">👨‍🍳 조리법</h4>
            <div className="space-y-3">
              {recipe.instructions.map((instruction, index) => (
                <div key={index} className="flex space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-gray-700 leading-relaxed">{instruction}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 태그 */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">🏷️ 태그</h4>
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Heart className="w-4 h-4" />
                <span className="text-sm">저장</span>
              </button>
              <button className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                <span className="text-sm">공유</span>
              </button>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onNewRecipe}
                className="flex items-center space-x-2 px-4 py-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>새 레시피</span>
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
