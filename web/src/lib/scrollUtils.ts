/**
 * 모바일과 데스크톱에서 모두 작동하는 스마트 스크롤 유틸리티
 */

// 모바일 디바이스 감지 (개발자 도구 시뮬레이션 포함)
const isMobileDevice = (): boolean => {
  const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isMobileTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 2;
  const isMobileScreen = window.innerWidth <= 768; // 개발자 도구 시뮬레이션 지원
  
  return isMobileUA || isMobileTouch || isMobileScreen;
};

// iOS 디바이스 감지
const isIOSDevice = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * 크로스 플랫폼 자동 스크롤 함수
 * @param element - 스크롤할 대상 요소
 * @param options - 스크롤 옵션
 */
export const smartScrollToBottom = (
  element: HTMLElement | null,
  options: { smooth?: boolean; delay?: number } = {}
): void => {
  if (!element) return;

  const { smooth = true, delay = 0 } = options;
  const isMobile = isMobileDevice();
  const isIOS = isIOSDevice();

  const performScroll = () => {
    try {
      if (isMobile) {
        // 모바일: 더 안정적인 스크롤 방식
        if (isIOS) {
          // iOS: scrollIntoView without smooth behavior
          element.scrollIntoView({ block: 'end', inline: 'nearest' });
        } else {
          // Android: scrollTo 사용
          const container = element.closest('[data-scroll-container]') || 
                           element.parentElement?.closest('.overflow-y-auto') ||
                           document.documentElement;
          
          if (container && container.scrollTo) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: smooth ? 'smooth' : 'auto'
            });
          } else {
            element.scrollIntoView({ block: 'end', inline: 'nearest' });
          }
        }
      } else {
        // 데스크톱: 기존 방식 유지
        element.scrollIntoView({ 
          behavior: smooth ? 'smooth' : 'auto',
          block: 'end',
          inline: 'nearest'
        });
      }
    } catch (error) {
      // Fallback: 기본 스크롤
      console.warn('Smart scroll failed, using fallback:', error);
      element.scrollIntoView({ block: 'end' });
    }
  };

  if (delay > 0) {
    setTimeout(performScroll, delay);
  } else {
    // 모바일에서는 약간의 지연을 주어 DOM 렌더링 완료 대기
    if (isMobile) {
      setTimeout(performScroll, 50);
    } else {
      performScroll();
    }
  }
};

/**
 * React useEffect와 함께 사용하기 위한 스크롤 함수
 */
export const createScrollHandler = (elementRef: React.RefObject<HTMLElement>) => {
  return (options?: { smooth?: boolean; delay?: number }) => {
    smartScrollToBottom(elementRef.current, options);
  };
};
