'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { trackEvent } from '@/lib/analytics';
import {
  generateShareImage,
  shareText,
  telegramShareUrl,
  twitterShareUrl,
  whatsappShareUrl,
  type ShareCardData,
} from '@/utils/share-image';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareCardData;
}

const SHARE_URL = 'https://pulse.live';

export function ShareModal({ isOpen, onClose, data }: ShareModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let objectUrl: string | null = null;
    void generateShareImage(data)
      .then((blob) => {
        setImageBlob(blob);
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => setImageUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImageUrl(null);
      setImageBlob(null);
      setCopied(false);
    };
  }, [isOpen, data]);

  const text = shareText(data);

  const open = (channel: string, url: string): void => {
    trackEvent('share', { channel, streak: data.streak, points: data.pointsEarned });
    window.open(url, '_blank', 'noopener');
  };

  const copy = async (): Promise<void> => {
    trackEvent('share', { channel: 'clipboard', streak: data.streak });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing to do
    }
  };

  const download = (): void => {
    if (!imageBlob) return;
    trackEvent('share', { channel: 'download', streak: data.streak });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(imageBlob);
    a.download = 'pulse-moment.png';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share your moment! 🎉">
      <div className="flex flex-col gap-4">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`PULSE share card: ${data.message}`}
            className="w-full rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
        ) : (
          <div className="flex aspect-square w-full animate-pulse items-center justify-center rounded-xl border-2 border-dashed border-black bg-white/50 text-sm font-bold">
            Creating your card…
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-sm font-bold">
          <button
            className="rounded-xl border-2 border-black bg-black px-3 py-3 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black/80 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={() => open('twitter', twitterShareUrl(text, SHARE_URL))}
          >
            𝕏 Post
          </button>
          <button
            className="rounded-xl border-2 border-black bg-emerald-400 px-3 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-emerald-300 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={() => open('whatsapp', whatsappShareUrl(text))}
          >
            WhatsApp
          </button>
          <button
            className="rounded-xl border-2 border-black bg-sky-400 px-3 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-sky-300 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={() => open('telegram', telegramShareUrl(text, SHARE_URL))}
          >
            Telegram
          </button>
          <button
            className="rounded-xl border-2 border-black bg-white px-3 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white/70 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={() => void copy()}
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
          <button
            className="rounded-xl border-2 border-black bg-white px-3 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-white/70 active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
            onClick={download}
            disabled={!imageBlob}
          >
            ⬇️ Save
          </button>
          <button
            className="rounded-xl px-3 py-3 font-bold text-black/60 transition-colors hover:bg-black/10"
            onClick={onClose}
          >
            Later
          </button>
        </div>
      </div>
    </Modal>
  );
}
