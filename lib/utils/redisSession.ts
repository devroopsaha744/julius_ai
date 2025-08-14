import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function addMessage(sessionId: string, role: "user" | "assistant", content: string) {
  const key = `session:${sessionId}`;
  await redis.lpush(key, JSON.stringify({ role, content }));
  await redis.expire(key, 2 * 60 * 60); // 2 hours TTL
}

export async function getMessages(sessionId: string) {
  const key = `session:${sessionId}`;
  const rawMessages = await redis.lrange(key, 0, -1);
  return rawMessages.reverse().map((msg) => JSON.parse(msg)); 
  // returns: [{ role: "user", content: "..." }, { role: "assistant", content: "..." }]
}

export async function deleteSession(sessionId: string) {
  const key = `session:${sessionId}`;
  return await redis.del(key);
}
