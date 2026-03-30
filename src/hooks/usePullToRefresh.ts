import { useState, useEffect, useCallback } from 'react';

interface UsePullToRefreshProps {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].pageY);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY === 0 || refreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY;

    if (diff > 0 && window.scrollY === 0) {
      setPulling(true);
      const progress = Math.min(diff / threshold, 1.2);
      setPullProgress(progress);
      
      // Prevent default to disable native browser pull-to-refresh
      if (e.cancelable) e.preventDefault();
    }
  }, [startY, threshold, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    setPulling(false);
    setStartY(0);

    if (pullProgress >= 1) {
      setRefreshing(true);
      setPullProgress(1); // Keep it at 1 for the spinner
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }
  }, [pullProgress, onRefresh]);

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { pulling, pullProgress, refreshing };
}
