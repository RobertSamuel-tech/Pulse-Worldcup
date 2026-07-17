/**
 * TxLINE API shapes (OpenAPI: https://txline.txodds.com/docs/docs.yaml).
 * Feed rows are canonicalised records whose exact fields vary by feed version —
 * keep them loose here and narrow at the transformation layer once real
 * payloads are observed. TODO(Step: match data): type fixture/score/odds rows.
 */
export type TxLineRecord = Record<string, unknown>;

/** Row from GET /api/fixtures/snapshot (verified against live devnet data). */
export interface TxLineFixture {
  Ts: number;
  StartTime: number; // epoch ms
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
  GameState?: number;
}

/** Subset of a GET /api/scores/snapshot/{fixtureId} row we consume. */
export interface TxLineScoreRow {
  action?: string;
  ts?: number;
  seq?: number;
  /** Soccer status code — "NS" | "H1" | "HT" | "H2" | "ET1" | "ET2" | "PE" | "F" | "END" | … */
  statusSoccerId?: string | Record<string, unknown>;
  scoreSoccer?: {
    Participant1?: { Total?: { Goals?: number } };
    Participant2?: { Total?: { Goals?: number } };
  };
  clock?: { running?: boolean; seconds?: number };
  [key: string]: unknown;
}

export interface GuestSessionResponse {
  token: string;
}

export interface StreamCallbacks {
  /** Each SSE `data:` payload, JSON-parsed when possible. */
  onMessage: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

/** Handle for an open (auto-reconnecting) SSE stream. */
export interface StreamHandle {
  close: () => void;
}
