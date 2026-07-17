# 🔧 Test TxLINE Integration

Verify the TxLINE API integration end-to-end (see TXLINE_INTEGRATION_GUIDE.md for endpoint details):

1. **Auth:** call `POST /auth/guest-session` on devnet, then `POST /auth/activate-token`. Confirm a valid API token is returned.
2. **Schedule:** call `GET /scores/schedule` and print the number of matches plus the first 3 (teams, kickoff, status).
3. **Live snapshot:** pick a live (or any) match ID and call `GET /scores/soccer/{matchId}`. Verify clock, score, stats, and events parse into our `PulseMatch` type without errors.
4. **Odds:** call `GET /odds/stableprice/{matchId}` and verify implied probabilities compute correctly (100 / decimalOdds).
5. **Stream:** open the WebSocket to `/stream/scores`, hold for 30 seconds, log received message types, verify reconnect logic by force-closing once.

Report a pass/fail table per step. On failure: capture status code + response body, check the troubleshooting table in TXLINE_INTEGRATION_GUIDE.md, and propose the fix.
