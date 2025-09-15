import Redis from "ioredis";
import { randomUUID } from "crypto";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis-17022.c273.us-east-1-2.ec2.redns.redis-cloud.com',
  port: Number(process.env.REDIS_PORT) || 17022,
  username: process.env.REDIS_USERNAME || 'default',
  password: process.env.REDIS_PASSWORD || '4kqPwKhKnQYQVernPOMkQL01VhuA9KVJ',
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

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
