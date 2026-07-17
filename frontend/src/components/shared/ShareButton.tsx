'use client';

import { Button } from '@/components/ui/Button';
import { twitterShareUrl } from '@/utils/share-image';

interface ShareButtonProps {
  text: string; // e.g. "I sensed that goal! 🧠⚽ 7-streak on Pulse"
  url?: string;
}

/** TODO(Step: social sharing): share image generation + WhatsApp/Telegram/copy options. */
export function ShareButton({ text, url = 'https://pulse.live' }: ShareButtonProps) {
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // fall through to Twitter intent
      }
    }
    window.open(twitterShareUrl(text, url), '_blank', 'noopener');
  };

  return (
    <Button variant="secondary" onClick={handleShare} aria-label="Share your result">
      Share 📤
    </Button>
  );
}
