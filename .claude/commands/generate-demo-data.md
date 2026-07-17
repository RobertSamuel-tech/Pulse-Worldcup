# 📊 Generate Demo Match Data

Create/refresh the demo replay scenarios in `scripts/seed-demo-data.ts` (see JUDGING_OPTIMIZATION.md → Demo Replay Mode):

1. **demo_high_scoring** — "Brazil vs Argentina (7 Goals!)": goals at 12', 34', 56', 78', 82', 88'; yellow 23'; red 67'; corner 45'. Final 5-2.
2. **demo_tense_finish** — "England vs France (Late Winner)": yellow 3', Mbappe 31', corner 66', Kane 78' equalizer, Griezmann 89' winner. Final 1-2.
3. **demo_card_fest** — "Germany vs Spain (Red Card Chaos)": 4 yellows, reds at 44' and 67', goals 33', 56', 82'. Final 2-1.

Requirements:
- Event payloads must match the TxLINE event schema exactly (same fields as `WS /stream/scores` messages) so the replay path exercises the SAME resolution code as live data.
- Include realistic clock progression, possession/shot stat updates every simulated minute, and period transitions (1H → HT → 2H → FT).
- Seed into the database (Match + MatchEvent rows flagged as demo) and verify the playback controller fires each event at the right simulated minute at 1x, 2x, and 4x speed.

Finish by running the replay end-to-end once and confirming predictions resolve correctly against the recorded events.
