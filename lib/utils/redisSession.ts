import Redis from "ioredis";
import { randomUUID } from "crypto";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Prefer a single REDIS_URL if provided, otherwise read individual env vars.
const redisConnection = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

// Minimal validation and helpful logging if Redis is not configured.
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  console.warn('Redis not fully configured: set REDIS_URL or REDIS_HOST (+ REDIS_PORT/USERNAME/PASSWORD) in .env.local');
}

const redis = typeof redisConnection === 'string' ? new Redis(redisConnection) : new Redis(redisConnection as any);

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

// Helper to ensure Redis connection
async function ensureConnection() {
  if (redis.status !== 'ready') {
    try {
      await redis.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
}

export async function createSession() {
  await ensureConnection();
  const sessionId = randomUUID();
  const key = `session:${sessionId}`;
  await redis.del(key);
  await redis.expire(key, 2 * 60 * 60);
  return sessionId;
}

export async function addMessage(sessionId: string, role: "user" | "assistant", content: string) {
  await ensureConnection();
  const key = `session:${sessionId}`;
  await redis.lpush(key, JSON.stringify({ role, content }));
  await redis.expire(key, 2 * 60 * 60); // 2 hours TTL
}

export async function getMessages(sessionId: string) {
  await ensureConnection();
  const key = `session:${sessionId}`;
  const rawMessages = await redis.lrange(key, 0, -1);
  return rawMessages.reverse().map((msg) => JSON.parse(msg)); 
  // returns: [{ role: "user", content: "..." }, { role: "assistant", content: "..." }]
}

export async function deleteSession(sessionId: string) {
  const key = `session:${sessionId}`;
  return await redis.del(key);
}

// Simple counter helpers for per-session small state (e.g. number of attempts without code)
export async function incrCounter(sessionId: string, counterName: string) {
  await ensureConnection();
  const key = `session:${sessionId}:counter:${counterName}`;
  const val = await redis.incr(key);
  // keep the counter TTL aligned with session
  await redis.expire(key, 2 * 60 * 60);
  return Number(val);
}

export async function getCounter(sessionId: string, counterName: string) {
  await ensureConnection();
  const key = `session:${sessionId}:counter:${counterName}`;
  const val = await redis.get(key);
  return val ? Number(val) : 0;
}

export async function resetCounter(sessionId: string, counterName: string) {
  await ensureConnection();
  const key = `session:${sessionId}:counter:${counterName}`;
  await redis.del(key);
}
