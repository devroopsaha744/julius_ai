import Redis from "ioredis";
import { randomUUID } from "crypto";
import dotenv from 'dotenv';
import dbConnect from './mongoConnection';
import Message from '../models/Message';
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

export async function addMessage(sessionId: string, role: "user" | "assistant", content: string, userId?: string) {
  await dbConnect();

  const messageData = {
    role,
    content,
    timestamp: new Date(),
  };

  // Try to find existing conversation document for this session
  let conversationDoc = await Message.findOne({ sessionId });

  if (conversationDoc) {
    // Append to existing conversation
    conversationDoc.conversation.push(messageData);
    if (userId && !conversationDoc.userId) {
      conversationDoc.userId = userId;
    }
    await conversationDoc.save();
  } else {
    // Create new conversation document
    const newConversation = new Message({
      sessionId,
      userId,
      conversation: [messageData],
    });
    await newConversation.save();
  }
}

export async function getMessages(sessionId: string) {
  await dbConnect();
  const conversationDoc = await Message.findOne({ sessionId });
  return conversationDoc ? conversationDoc.conversation : [];
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

// Generic JSON helpers for caching small objects (like curator outputs)
export async function setJSON(key: string, value: unknown, ttlSeconds?: number) {
  try {
    await ensureConnection();
  } catch (err) {
    // ensureConnection already logs
  }
  const s = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, s, 'EX', ttlSeconds);
  } else {
    await redis.set(key, s);
  }
}

export async function getJSON<T = any>(key: string): Promise<T | null> {
  try {
    await ensureConnection();
  } catch (err) {
    // ensureConnection already logs
  }
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('Failed to parse JSON from Redis key', key, (err as Error).message);
    return null;
  }
}

export async function delKey(key: string) {
  try {
    await ensureConnection();
  } catch (err) {
    // ignore
  }
  await redis.del(key);
}
