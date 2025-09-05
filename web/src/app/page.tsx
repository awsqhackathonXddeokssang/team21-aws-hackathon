'use client';

import { useState } from 'react';
import SplashScreen from '@/components/SplashScreen';
import ChatScreen from '@/components/ChatScreen';

type Screen = 'splash' | 'chat';

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

  const handleSplashComplete = () => {
    setCurrentScreen('chat');
  };

  if (currentScreen === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return <ChatScreen />;
}
