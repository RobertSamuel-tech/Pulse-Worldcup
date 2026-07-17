/** National team name → flag emoji. Falls back to the team code in a neutral chip. */
const FLAGS: Record<string, string> = {
  Argentina: '🇦🇷',
  Australia: '🇦🇺',
  Belgium: '🇧🇪',
  Brazil: '🇧🇷',
  Cameroon: '🇨🇲',
  Canada: '🇨🇦',
  Colombia: '🇨🇴',
  'Costa Rica': '🇨🇷',
  Croatia: '🇭🇷',
  Denmark: '🇩🇰',
  Ecuador: '🇪🇨',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Ghana: '🇬🇭',
  India: '🇮🇳',
  Iran: '🇮🇷',
  Italy: '🇮🇹',
  Japan: '🇯🇵',
  Mexico: '🇲🇽',
  Morocco: '🇲🇦',
  Myanmar: '🇲🇲',
  Netherlands: '🇳🇱',
  'New Zealand': '🇳🇿',
  Nigeria: '🇳🇬',
  Norway: '🇳🇴',
  Poland: '🇵🇱',
  Portugal: '🇵🇹',
  Qatar: '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Senegal: '🇸🇳',
  Serbia: '🇷🇸',
  'South Korea': '🇰🇷',
  Spain: '🇪🇸',
  Switzerland: '🇨🇭',
  Uruguay: '🇺🇾',
  USA: '🇺🇸',
  'United States': '🇺🇸',
  Vietnam: '🇻🇳',
  Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
};

export function teamFlag(teamName: string): string | null {
  return FLAGS[teamName] ?? null;
}

/** All known team names (favorite-team picker options). */
export const TEAM_NAMES = Object.keys(FLAGS).filter((n) => n !== 'United States');
