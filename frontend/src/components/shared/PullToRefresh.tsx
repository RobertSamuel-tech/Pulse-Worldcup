'use client';

import { useCallback, useRef, useState } from 'react';
import type { ReactNode, TouchEvent } from 'react';

const TRIGGER_DISTANCE_PX = 70;
const MAX_PULL_PX = 110;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

/** Lightweight touch-based pull-to-refresh for the mobile match list. */
export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0]?.clientY ?? null;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if (startY.current === null || refreshing) return;
      const delta = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPull(Math.min(delta * 0.5, MAX_PULL_PX));
      }
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(() => {
    startY.current = null;
    if (pull >= TRIGGER_DISTANCE_PX && !refreshing) {
      setRefreshing(true);
      void onRefresh().finally(() => {
        setRefreshing(false);
        setPull(0);
      });
    } else {
      setPull(0);
    }
  }, [pull, refreshing, onRefresh]);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-end justify-center overflow-hidden transition-[height]"
        style={{ height: refreshing ? 40 : pull }}
        aria-hidden={pull === 0 && !refreshing}
      >
        <span
          className={`pb-2 text-xl font-black ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${pull * 3}deg)` } : undefined}
        >
          ↻
        </span>
      </div>
      {children}
    </div>
  );
}
