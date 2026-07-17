import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-4 border-black bg-white/60 backdrop-blur-md p-4',
        'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
