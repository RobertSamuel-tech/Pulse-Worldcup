---
name: solana-integration
description: Solana/Web3 expertise — wallet adapter, signature auth, on-chain subscription, optional NFT badges
---

# Solana Integration Expertise

## Wallet connection (frontend)
- `@solana/wallet-adapter-react` with Phantom + Backpack adapters only
- Wallet UX must feel invisible: one click, no crypto jargon anywhere in the UI
- Handle: not installed (deep link to install), rejected connection, network mismatch

## Auth flow (wallet = identity)
1. Backend issues a nonce challenge
2. User signs message with wallet
3. Backend verifies signature (`tweetnacl` / `@solana/web3.js`), issues JWT (15 min) + refresh token (7 days, rotated)
4. User record keyed by `walletAddress` (unique)

## TxLINE on-chain subscription
- Devnet during development, Mainnet for the demo
- Service Level 12 (free real-time World Cup tier)
- Confirm the transaction before calling `/auth/activate-token`
- Retry/reporting: if the subscribe tx fails consistently, surface a friendly retry — never a raw error

## NFT achievement badges (OPTIONAL — only if time permits)
- Metaplex mint with metadata: name, description, image, attributes (Achievement, Date, Rarity, Owner)
- Store `nftAddress` on the Achievement row
- Never block the achievement UX on minting — mint async in a Bull job

## Rules
- No private keys or RPC secrets in frontend code
- Devnet/mainnet selection via env var, never hardcoded
- All transactions must have user-visible pending/success/failure states
