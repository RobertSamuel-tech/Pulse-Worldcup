'use client';

import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-black hover:bg-black/80 text-white',
  secondary: 'bg-white/60 hover:bg-white/90 text-black',
  success: 'bg-emerald-400 hover:bg-emerald-300 text-black',
  danger: 'bg-red-400 hover:bg-red-300 text-black',
  ghost: 'bg-transparent hover:bg-black/10 text-black border-transparent shadow-none',
};

export function Button({
  variant = 'primary',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-xl border-2 border-black px-4 py-3 text-sm font-bold',
        'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all',
        'active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
        'min-h-12 min-w-12 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? '…' : children}
    </button>
  );
}
