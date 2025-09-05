'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);

  useEffect(() => {
    // 순차적 애니메이션
    const titleTimer = setTimeout(() => setShowTitle(true), 1000);
    const subtitleTimer = setTimeout(() => setShowSubtitle(true), 1500);
    
    // 3초 후 페이드아웃
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => onComplete(), 300);
    }, 3000);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(subtitleTimer);
      clearTimeout(fadeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-emerald-50 flex flex-col items-center justify-center relative transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      {/* 반짝이는 이펙트들 */}
      <Sparkles className="absolute top-32 left-16 w-4 h-4 text-yellow-400 sparkle" style={{ animationDelay: '0s' }} />
      <Sparkles className="absolute top-40 right-20 w-3 h-3 text-orange-400 sparkle" style={{ animationDelay: '0.5s' }} />
      <Sparkles className="absolute bottom-40 left-20 w-5 h-5 text-emerald-400 sparkle" style={{ animationDelay: '1s' }} />
      <Sparkles className="absolute bottom-32 right-16 w-4 h-4 text-pink-400 sparkle" style={{ animationDelay: '1.5s' }} />

      <div className="text-center relative">
        {/* 메인 아이콘 - 떨어지는 애니메이션 */}
        <div className="mb-8 drop-in relative inline-block">
          <ChefHat className="w-24 h-24 text-orange-500 mx-auto" />
          {/* 요리 중 표시 점 */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
        </div>
        
        {/* 제목 - 페이드인 */}
        <h1 className={`text-3xl font-bold text-gray-800 mb-4 ${showTitle ? 'fade-in-up' : 'opacity-0'}`}>
          AI 셰프 어시스턴트
        </h1>
        
        {/* 서브타이틀 - 페이드인 */}
        <p className={`text-lg text-gray-600 ${showSubtitle ? 'fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
          대화 한 번으로, 저녁 메뉴 고민 끝.
        </p>
      </div>
    </div>
  );
}
