/**
 * AudioRingBuffer.ts
 * High-performance circular ring buffer and object pool for real-time PCM audio streaming.
 * Eliminates garbage collection pressure and audio dropouts during live telephony uplink/downlink.
 */

export class CircularRingBuffer {
  private buffer: Buffer;
  private capacity: number;
  private writePos = 0;
  private readPos = 0;
  private available = 0;

  constructor(capacityBytes: number = 64 * 1024) { // Default 64KB (~4 seconds of 8kHz 16-bit PCM)
    this.capacity = capacityBytes;
    this.buffer = Buffer.alloc(capacityBytes);
  }

  /**
   * Writes PCM bytes into the ring buffer using high-performance chunked memory copy.
   * If writing exceeds capacity, older unread bytes are dropped (loss-resilient audio stream).
   */
  public write(data: Buffer): number {
    if (!data || data.length === 0) return 0;

    const bytesToWrite = Math.min(data.length, this.capacity);
    const offset = data.length - bytesToWrite;

    // First contiguous segment
    const firstChunk = Math.min(bytesToWrite, this.capacity - this.writePos);
    data.copy(this.buffer, this.writePos, offset, offset + firstChunk);

    // Second segment if wrapping past capacity boundary
    const secondChunk = bytesToWrite - firstChunk;
    if (secondChunk > 0) {
      data.copy(this.buffer, 0, offset + firstChunk, offset + bytesToWrite);
    }

    this.writePos = (this.writePos + bytesToWrite) % this.capacity;
    this.available = Math.min(this.capacity, this.available + bytesToWrite);
    if (this.available === this.capacity) {
      // Overwrite condition: advance read pointer
      this.readPos = this.writePos;
    }

    return bytesToWrite;
  }

  /**
   * Reads up to `length` bytes from the ring buffer into an output buffer using chunked memory copy.
   */
  public read(length: number): Buffer {
    const bytesToRead = Math.min(length, this.available);
    if (bytesToRead <= 0) {
      return Buffer.alloc(0);
    }

    const output = Buffer.alloc(bytesToRead);
    const firstChunk = Math.min(bytesToRead, this.capacity - this.readPos);
    this.buffer.copy(output, 0, this.readPos, this.readPos + firstChunk);

    const secondChunk = bytesToRead - firstChunk;
    if (secondChunk > 0) {
      this.buffer.copy(output, firstChunk, 0, secondChunk);
    }

    this.readPos = (this.readPos + bytesToRead) % this.capacity;
    this.available -= bytesToRead;
    return output;
  }

  public get availableBytes(): number {
    return this.available;
  }

  public get freeSpaceBytes(): number {
    return this.capacity - this.available;
  }

  public clear(): void {
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
  }
}

/**
 * AudioBufferPool: Pre-allocates fixed-size 20ms and 100ms PCM buffers
 * to avoid memory churning in high-throughput telephony streaming loops.
 */
export class AudioBufferPool {
  private pool: Buffer[] = [];
  private readonly bufferSize: number;
  private readonly maxPoolSize: number;

  constructor(bufferSize: number = 320, maxPoolSize: number = 100) {
    this.bufferSize = bufferSize;
    this.maxPoolSize = maxPoolSize;

    // Warm up pool
    for (let i = 0; i < 20; i++) {
      this.pool.push(Buffer.alloc(bufferSize));
    }
  }

  /**
   * Acquires a cleared buffer from the pool or creates one if pool is drained
   */
  public acquire(): Buffer {
    const buf = this.pool.pop();
    if (buf) {
      buf.fill(0);
      return buf;
    }
    return Buffer.alloc(this.bufferSize);
  }

  /**
   * Returns a buffer back to the pool for reuse
   */
  public release(buf: Buffer): void {
    if (buf && buf.length === this.bufferSize && this.pool.length < this.maxPoolSize) {
      this.pool.push(buf);
    }
  }

  public get availableBuffers(): number {
    return this.pool.length;
  }
}
