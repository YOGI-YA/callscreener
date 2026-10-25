/**
 * ZeroTrustAuditEngine.ts
 * Cryptographic Tamper-Evident Call Screening Audit Chain & Field Encryption.
 * Uses SHA-256 hash pointers (tamper-evident Merkle/blockchain style)
 * and AES-256-GCM authenticated encryption for sensitive forensic logs.
 */

import crypto from 'crypto';

export interface AuditBlock {
  blockId: string;
  index: number;
  timestamp: string;
  callId: string;
  callerNumber: string;
  screeningVerdict: string;
  riskScore: number;
  payloadDigest: string;
  previousHash: string;
  currentHash: string;
  signature?: string;
}

export interface VerificationResult {
  valid: boolean;
  totalBlocks: number;
  brokenIndex?: number;
  error?: string;
}

export class ZeroTrustAuditEngine {
  private static chain: AuditBlock[] = [];
  private static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Computes SHA-256 digest of block contents
   */
  public static computeBlockHash(block: Omit<AuditBlock, 'currentHash' | 'signature'>): string {
    const canonical = [
      block.index,
      block.timestamp,
      block.callId,
      block.callerNumber,
      block.screeningVerdict,
      block.riskScore,
      block.payloadDigest,
      block.previousHash
    ].join('|');

    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Appends a new call screening event to the immutable tamper-evident chain
   */
  public static appendEvent(event: {
    callId: string;
    callerNumber: string;
    screeningVerdict: string;
    riskScore: number;
    rawPayload: any;
  }): AuditBlock {
    const previousBlock = this.chain[this.chain.length - 1];
    const previousHash = previousBlock ? previousBlock.currentHash : this.GENESIS_HASH;
    const index = this.chain.length;

    const payloadDigest = crypto
      .createHash('sha256')
      .update(typeof event.rawPayload === 'string' ? event.rawPayload : JSON.stringify(event.rawPayload))
      .digest('hex');

    const blockBase: Omit<AuditBlock, 'currentHash'> = {
      blockId: `blk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      index,
      timestamp: new Date().toISOString(),
      callId: event.callId,
      callerNumber: event.callerNumber,
      screeningVerdict: event.screeningVerdict,
      riskScore: event.riskScore,
      payloadDigest,
      previousHash
    };

    const currentHash = this.computeBlockHash(blockBase);
    const completeBlock: AuditBlock = {
      ...blockBase,
      currentHash
    };

    this.chain.push(completeBlock);
    return completeBlock;
  }

  /**
   * Verifies the entire cryptographic integrity of the audit chain
   */
  public static verifyChainIntegrity(): VerificationResult {
    if (this.chain.length === 0) {
      return { valid: true, totalBlocks: 0 };
    }

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      // Verify index continuity
      if (block.index !== i) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          brokenIndex: i,
          error: `Index mismatch at position ${i}: expected ${i}, found ${block.index}`
        };
      }

      // Verify previous hash linkage
      const expectedPrev = i === 0 ? this.GENESIS_HASH : this.chain[i - 1].currentHash;
      if (block.previousHash !== expectedPrev) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          brokenIndex: i,
          error: `Hash pointer broken at block ${i}: expected prev ${expectedPrev.slice(0, 8)}..., found ${block.previousHash.slice(0, 8)}...`
        };
      }

      // Verify content hash matches
      const recomputed = this.computeBlockHash(block);
      if (recomputed !== block.currentHash) {
        return {
          valid: false,
          totalBlocks: this.chain.length,
          brokenIndex: i,
          error: `Tampered block detected at ${i}! Hash mismatch.`
        };
      }
    }

    return { valid: true, totalBlocks: this.chain.length };
  }

  /**
   * Encrypts sensitive audit data using AES-256-GCM with authentication tag
   */
  public static encryptSensitiveField(plaintext: string, secretKeyHex: string): {
    ciphertext: string;
    iv: string;
    tag: string;
  } {
    const key = Buffer.from(secretKeyHex.padEnd(64, '0').slice(0, 64), 'hex');
    const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      tag
    };
  }

  /**
   * Decrypts AES-256-GCM ciphertext and validates authentication tag
   */
  public static decryptSensitiveField(
    ciphertext: string,
    ivHex: string,
    tagHex: string,
    secretKeyHex: string
  ): string {
    const key = Buffer.from(secretKeyHex.padEnd(64, '0').slice(0, 64), 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public static getChain(): AuditBlock[] {
    return [...this.chain];
  }

  public static reset(): void {
    this.chain = [];
  }
}
