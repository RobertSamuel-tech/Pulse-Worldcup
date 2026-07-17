import * as fs from 'node:fs';
import * as path from 'node:path';
import * as anchor from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import nacl from 'tweetnacl';
import txoracleIdl from '../idl/txoracle.json';
import { config } from '../config';
import { WalletUnfundedError } from '../utils/errors';
import { logger } from '../utils/logger';

/** TxL token mint (devnet). Mainnet value: see documentation/programs/mainnet. */
const DEVNET_TOKEN_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
const MIN_FEE_BALANCE_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

/**
 * On-chain TxLINE subscription (free World Cup tier: 0 TxL, SOL fees only).
 * Flow: subscribe(serviceLevel, weeks) on the txoracle program → confirmed txSig →
 * wallet-sign `${txSig}:${leagues}:${jwt}` for the off-chain activation endpoint.
 */
export class SolanaSubscriptionService {
  private keypair: Keypair | null = null;

  /** Loads the server wallet, creating (and persisting) one on first run. */
  getKeypair(): Keypair {
    if (this.keypair) return this.keypair;
    const walletPath = path.resolve(config.TXLINE_WALLET_PATH);
    if (fs.existsSync(walletPath)) {
      const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')) as number[]);
      this.keypair = Keypair.fromSecretKey(secret);
    } else {
      this.keypair = Keypair.generate();
      fs.mkdirSync(path.dirname(walletPath), { recursive: true });
      fs.writeFileSync(walletPath, JSON.stringify(Array.from(this.keypair.secretKey)));
      logger.warn('txline_wallet_created', {
        walletPath,
        address: this.keypair.publicKey.toBase58(),
        hint: 'Fund with devnet SOL (https://faucet.solana.com) to enable subscription.',
      });
    }
    return this.keypair;
  }

  /** Airdrops devnet SOL when the fee balance is too low. Best effort — faucet rate limits. */
  private async ensureFeeBalance(connection: Connection, wallet: Keypair): Promise<void> {
    const balance = await connection.getBalance(wallet.publicKey);
    if (balance >= MIN_FEE_BALANCE_LAMPORTS) return;
    const address = wallet.publicKey.toBase58();
    logger.info('solana_requesting_airdrop', { address, balance });
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
      const latest = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
      logger.info('solana_airdrop_confirmed', { signature: sig });
    } catch (err) {
      logger.warn('solana_airdrop_failed', {
        address,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new WalletUnfundedError(address);
    }
  }

  /**
   * Subscribes on-chain and returns the confirmed transaction signature.
   * Idempotent enough for our use: re-subscribing extends the validity period.
   */
  async subscribeFreeTier(): Promise<string> {
    const wallet = this.getKeypair();
    const connection = new Connection(config.SOLANA_RPC_URL, 'confirmed');
    await this.ensureFeeBalance(connection, wallet);

    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {
      commitment: 'confirmed',
    });
    const program = new anchor.Program(txoracleIdl as anchor.Idl, provider);
    const tokenMint = DEVNET_TOKEN_MINT;

    const userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );

    // The free tier charges 0 TxL but the token account must still exist.
    const accountInfo = await connection.getAccountInfo(userTokenAccount);
    if (!accountInfo) {
      logger.info('solana_creating_token_account', { ata: userTokenAccount.toBase58() });
      const createTx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userTokenAccount,
          wallet.publicKey,
          tokenMint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
      await anchor.web3.sendAndConfirmTransaction(connection, createTx, [wallet], {
        commitment: 'confirmed',
      });
    }

    const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('pricing_matrix')],
      program.programId,
    );
    const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('token_treasury_v2')],
      program.programId,
    );
    const tokenTreasuryVault = getAssociatedTokenAddressSync(
      tokenMint,
      tokenTreasuryPda,
      true,
      TOKEN_2022_PROGRAM_ID,
    );

    logger.info('solana_subscribing', {
      serviceLevel: config.TXLINE_SERVICE_LEVEL,
      weeks: config.TXLINE_SUBSCRIPTION_WEEKS,
      wallet: wallet.publicKey.toBase58(),
    });

    const subscribe = program.methods.subscribe;
    if (!subscribe) {
      throw new Error('txoracle IDL has no subscribe instruction');
    }
    const tx = (await subscribe(config.TXLINE_SERVICE_LEVEL, config.TXLINE_SUBSCRIPTION_WEEKS)
      .accounts({
        user: wallet.publicKey,
        pricingMatrix: pricingMatrixPda,
        tokenMint,
        userTokenAccount,
        tokenTreasuryVault,
        tokenTreasuryPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction()) as Transaction;

    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = wallet.publicKey;
    tx.sign(wallet);

    const txSig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature: txSig, ...latestBlockhash }, 'confirmed');
    logger.info('solana_subscribe_confirmed', { txSig });
    return txSig;
  }

  /** Detached ed25519 signature over `${txSig}:${leagues}:${jwt}`, Base64-encoded. */
  signActivationMessage(txSig: string, leagues: number[], jwt: string): string {
    const wallet = this.getKeypair();
    const message = new TextEncoder().encode(`${txSig}:${leagues.join(',')}:${jwt}`);
    return Buffer.from(nacl.sign.detached(message, wallet.secretKey)).toString('base64');
  }
}

export const solanaSubscriptionService = new SolanaSubscriptionService();
