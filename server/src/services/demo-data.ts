/**
 * Hardcoded demo scenarios — the guaranteed fallback for Replay Mode.
 * These ALWAYS seed if the demo tables are empty, so /replay is never blank
 * even when OpenRouter is unreachable or unconfigured.
 */

export interface DemoEventSeed {
  type: 'GOAL' | 'RED_CARD' | 'YELLOW_CARD' | 'CORNER' | 'PENALTY' | 'SUBSTITUTION';
  minute: number;
  team: 'home' | 'away';
  player?: string;
  description: string;
}

export interface DemoMatchSeed {
  label: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamCode: string;
  awayTeamCode: string;
  homeScore: number;
  awayScore: number;
  stage: string;
  excitement: number; // 1-5
  events: DemoEventSeed[];
}

export const HARDCODED_DEMO_MATCHES: DemoMatchSeed[] = [
  {
    label: 'Goal Fest',
    homeTeam: 'Brazil',
    awayTeam: 'Argentina',
    homeTeamCode: 'BRA',
    awayTeamCode: 'ARG',
    homeScore: 5,
    awayScore: 2,
    stage: 'Quarter-final',
    excitement: 5,
    events: [
      { type: 'CORNER', minute: 4, team: 'home', description: 'Early corner for Brazil as Vinícius forces a save' },
      { type: 'GOAL', minute: 9, team: 'home', player: 'Vinícius Jr', description: 'GOAL! Vinícius cuts inside and curls it top corner' },
      { type: 'GOAL', minute: 17, team: 'away', player: 'Lionel Messi', description: 'GOAL! Messi answers with a trademark free kick' },
      { type: 'YELLOW_CARD', minute: 26, team: 'away', player: 'Rodrigo De Paul', description: 'Yellow card — De Paul chops down Rodrygo on the break' },
      { type: 'GOAL', minute: 31, team: 'home', player: 'Rodrygo', description: 'GOAL! Rodrygo taps in after a slick one-two' },
      { type: 'GOAL', minute: 44, team: 'home', player: 'Casemiro', description: 'GOAL! Casemiro thunders home a header from the corner' },
      { type: 'GOAL', minute: 52, team: 'away', player: 'Julián Álvarez', description: 'GOAL! Álvarez pounces on a loose back pass' },
      { type: 'CORNER', minute: 58, team: 'home', description: 'Corner Brazil — pressure building again' },
      { type: 'GOAL', minute: 63, team: 'home', player: 'Neymar Jr', description: 'GOAL! Neymar dances past three and slots it home' },
      { type: 'YELLOW_CARD', minute: 71, team: 'away', player: 'Nicolás Otamendi', description: 'Yellow card — Otamendi hauls down Neymar' },
      { type: 'GOAL', minute: 84, team: 'home', player: 'Neymar Jr', description: 'GOAL! Neymar again — Brazil are running riot' },
      { type: 'SUBSTITUTION', minute: 87, team: 'home', player: 'Endrick', description: 'Endrick comes on to a standing ovation' },
    ],
  },
  {
    label: 'Tense Finish',
    homeTeam: 'England',
    awayTeam: 'France',
    homeTeamCode: 'ENG',
    awayTeamCode: 'FRA',
    homeScore: 1,
    awayScore: 2,
    stage: 'Semi-final',
    excitement: 5,
    events: [
      { type: 'CORNER', minute: 7, team: 'home', description: 'Corner England — Kane heads just wide' },
      { type: 'YELLOW_CARD', minute: 19, team: 'home', player: 'Declan Rice', description: 'Yellow card — Rice stops Mbappé the only way he can' },
      { type: 'GOAL', minute: 36, team: 'home', player: 'Harry Kane', description: 'GOAL! Kane converts from the penalty spot' },
      { type: 'CORNER', minute: 48, team: 'away', description: 'Corner France — Saka clears off the line!' },
      { type: 'GOAL', minute: 61, team: 'away', player: 'Kylian Mbappé', description: 'GOAL! Mbappé equalizes with a lightning counter' },
      { type: 'SUBSTITUTION', minute: 70, team: 'away', player: 'Olivier Giroud', description: 'Giroud on for the final push' },
      { type: 'YELLOW_CARD', minute: 78, team: 'away', player: 'Jules Koundé', description: 'Yellow card — Koundé drags back Foden' },
      { type: 'CORNER', minute: 85, team: 'home', description: 'Corner England — huge chance goes begging' },
      { type: 'GOAL', minute: 90, team: 'away', player: 'Olivier Giroud', description: 'GOAL! Giroud wins it at the death — heartbreak for England!' },
    ],
  },
  {
    label: 'Card Chaos',
    homeTeam: 'Germany',
    awayTeam: 'Spain',
    homeTeamCode: 'GER',
    awayTeamCode: 'ESP',
    homeScore: 2,
    awayScore: 1,
    stage: 'Group Stage',
    excitement: 4,
    events: [
      { type: 'YELLOW_CARD', minute: 8, team: 'home', player: 'Antonio Rüdiger', description: 'Yellow card inside 10 minutes — Rüdiger sets the tone' },
      { type: 'GOAL', minute: 22, team: 'home', player: 'Jamal Musiala', description: 'GOAL! Musiala glides through and finishes coolly' },
      { type: 'YELLOW_CARD', minute: 29, team: 'away', player: 'Rodri', description: 'Yellow card — Rodri scythes down Wirtz' },
      { type: 'YELLOW_CARD', minute: 41, team: 'away', player: 'Pedri', description: 'Yellow card — tempers flaring before the break' },
      { type: 'RED_CARD', minute: 55, team: 'away', player: 'Carvajal', description: 'RED CARD! Carvajal sees a straight red for a lunging tackle' },
      { type: 'GOAL', minute: 68, team: 'away', player: 'Lamine Yamal', description: 'GOAL! Ten-man Spain strike back through Yamal' },
      { type: 'YELLOW_CARD', minute: 74, team: 'home', player: 'Joshua Kimmich', description: 'Yellow card — Kimmich for dissent' },
      { type: 'PENALTY', minute: 81, team: 'home', description: 'PENALTY to Germany! VAR spots a handball' },
      { type: 'GOAL', minute: 82, team: 'home', player: 'Kai Havertz', description: 'GOAL! Havertz buries the penalty' },
      { type: 'RED_CARD', minute: 89, team: 'home', player: 'Antonio Rüdiger', description: 'RED CARD! Second yellow for Rüdiger — chaos to the end' },
    ],
  },
];
