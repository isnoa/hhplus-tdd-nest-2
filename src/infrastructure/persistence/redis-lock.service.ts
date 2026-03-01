import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.client = new Redis({ host, port });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * Acquire a lock for a key with ttl (ms). Returns true if acquired.
   */
  async acquire(key: string, ttl: number): Promise<boolean> {
    const res = await this.client.set(key, 'locked', 'PX', ttl, 'NX');
    return res === 'OK';
  }

  /**
   * Release a lock (delete key). Safe to call even if not locked.
   */
  async release(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Run callback with lock held, automatically releasing.
   * Throws if could not acquire.
   */
  async runWithLock<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    const locked = await this.acquire(key, ttl);
    if (!locked) {
      throw new Error('lock_not_acquired');
    }
    try {
      return await callback();
    } finally {
      await this.release(key);
    }
  }
}
