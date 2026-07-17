export interface ShareCardData {
  username: string; // handle shown in the beat-me URL
  message: string; // e.g. "I SENSED THAT GOAL!"
  streak: number;
  pointsEarned: number;
}

const SIZE = 1080;

/** Generate a shareable PNG card via Canvas — PULSE branding, no deps. */
export async function generateShareImage(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background: slate-900 with a soft indigo glow top-left
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow = ctx.createRadialGradient(200, 160, 0, 200, 160, 900);
  glow.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
  glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Card frame
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(60, 60, SIZE - 120, SIZE - 120, 40);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Brand
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 84px Inter, system-ui, sans-serif';
  ctx.fillText('⚽ PULSE ⚡', SIZE / 2, 240);

  // Headline
  ctx.fillStyle = '#FCD34D';
  ctx.font = 'bold 64px Inter, system-ui, sans-serif';
  ctx.fillText(`🧠 ${data.message}`, SIZE / 2, 440);

  // Stats line
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 56px "JetBrains Mono", monospace';
  const statsLine =
    data.streak >= 2
      ? `🔥 ${data.streak}-Streak • +${data.pointsEarned} pts`
      : `💎 +${data.pointsEarned} pts`;
  ctx.fillText(statsLine, SIZE / 2, 580);

  // Beat me at
  ctx.fillStyle = '#94A3B8';
  ctx.font = '44px Inter, system-ui, sans-serif';
  ctx.fillText('Beat me at:', SIZE / 2, 740);
  ctx.fillStyle = '#818CF8';
  ctx.font = 'bold 52px Inter, system-ui, sans-serif';
  ctx.fillText(`pulse.live/@${data.username}`, SIZE / 2, 810);

  // Hashtags
  ctx.fillStyle = '#64748B';
  ctx.font = '40px Inter, system-ui, sans-serif';
  ctx.fillText('#WorldCup  #PulseApp', SIZE / 2, 940);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to render share image'));
    }, 'image/png');
  });
}

export function shareText(data: ShareCardData): string {
  const streakPart = data.streak >= 2 ? ` 🔥 ${data.streak}-streak,` : '';
  return `🧠 ${data.message}${streakPart} +${data.pointsEarned} pts on PULSE. Beat me at pulse.live/@${data.username} #WorldCup #PulseApp`;
}

export function twitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
