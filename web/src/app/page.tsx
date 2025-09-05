'use client';

import { useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import ChatScreen from '@/components/ChatScreen';

type Screen = 'splash' | 'chat';

export default function Home() {
  console.log('🏠 Home 컴포넌트 렌더링');
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

  const handleSplashComplete = () => {
    console.log('🎬 스플래시 완료 - 채팅 화면으로 전환');
    setCurrentScreen('chat');
  };

  console.log('📺 현재 화면:', currentScreen);

  if (currentScreen === 'splash') {
    console.log('🌟 스플래시 화면 렌더링');
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  console.log('💬 채팅 화면 렌더링');
  return <ChatScreen />;
}
