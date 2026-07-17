import Image from 'next/image';
import Link from 'next/link';
import { BackgroundMusic } from '@/components/shared/BackgroundMusic';
import { ConnectionStatus } from '@/components/shared/ConnectionStatus';
import { OfflineBanner } from '@/components/shared/OfflineBanner';
import type { ReactNode } from 'react';

/**
 * Main app shell: header with connection status, bottom navigation (thumb zone).
 * TODO(Step: UI polish): active-route highlighting, safe-area insets.
 */
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BackgroundMusic />
      <OfflineBanner />
      <header className="flex items-center justify-between border-b-4 border-black bg-white/40 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <Image src="/images/logo-golden-ball.webp" alt="" width={54} height={36} priority />
          PULSE
        </Link>
        <ConnectionStatus />
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 flex justify-around border-t-4 border-black bg-white/80 py-3 text-xs font-bold backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-black/10">
          Matches
        </Link>
        <Link href="/scratch" className="relative rounded-lg bg-amber-300 px-3 py-1.5 outline outline-2 outline-black hover:bg-amber-200">
          Scratch
          <span className="absolute -right-2 -top-2 rounded-full border-2 border-black bg-red-400 px-1 text-[8px] font-black">
            NEW
          </span>
        </Link>
        <Link href="/leaderboard" className="rounded-lg px-3 py-1.5 hover:bg-black/10">
          Leaderboard
        </Link>
        <Link href="/replay" className="rounded-lg px-3 py-1.5 hover:bg-black/10">
          Replay
        </Link>
        <Link href="/profile" className="rounded-lg px-3 py-1.5 hover:bg-black/10">
          Profile
        </Link>
      </nav>
    </div>
  );
}
