'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/types';
import { Bot, User, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ConversationalChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function ConversationalChat({ messages, isLoading }: ConversationalChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingMessage, setTypingMessage] = useState<string>('');
  const [showTyping, setShowTyping] = useState(false);

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  // 타이핑 효과
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === 'ai' && lastMessage.content) {
        setShowTyping(true);
        setTypingMessage('');
        
        let index = 0;
        const text = lastMessage.content;
        
        const typeInterval = setInterval(() => {
          if (index < text.length) {
            setTypingMessage(text.slice(0, index + 1));
            index++;
          } else {
            clearInterval(typeInterval);
            setShowTyping(false);
          }
        }, 30);

        return () => clearInterval(typeInterval);
      }
    }
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.type === 'user';
    const isLastAiMessage = message.type === 'ai' && index === messages.length - 1;
    
    return (
      <div
        key={message.id}
        className={clsx(
          "flex items-start space-x-3 mb-6",
          isUser ? "flex-row-reverse space-x-reverse" : ""
        )}
      >
        {/* 아바타 */}
        <div className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser 
            ? "bg-emerald-500 text-white" 
            : "bg-gray-200 text-gray-600"
        )}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        {/* 메시지 버블 */}
        <div className={clsx(
          "flex flex-col max-w-xs lg:max-w-md",
          isUser ? "items-end" : "items-start"
        )}>
          <div className={clsx(
            "px-4 py-3 rounded-2xl shadow-sm",
            isUser 
              ? "bg-emerald-500 text-white rounded-br-md" 
              : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
          )}>
            {isLastAiMessage && showTyping ? (
              <div className="flex items-center">
                <span>{typingMessage}</span>
                <span className="ml-1 w-0.5 h-4 bg-current animate-pulse"></span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
          
          {/* 시간 표시 */}
          <span className="text-xs text-gray-500 mt-1 px-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="max-w-2xl mx-auto">
        {/* 환영 메시지 */}
        {messages.length === 1 && (
          <div className="text-center py-8">
            <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              AI Chef Assistant
            </h3>
            <p className="text-gray-600 text-sm">
              맞춤 레시피와 실시간 가격 정보를 제공해드려요
            </p>
          </div>
        )}

        {/* 메시지들 */}
        {messages.map((message, index) => renderMessage(message, index))}

        {/* 로딩 인디케이터 */}
        {isLoading && (
          <div className="flex items-start space-x-3 mb-6">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200 px-4 py-3 shadow-sm">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <div className="loading-dots">
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                  <div className="loading-dot"></div>
                </div>
                <span className="text-sm text-gray-500">생각 중...</span>
              </div>
            </div>
          </div>
        )}

        {/* 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
