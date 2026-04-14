import { Redis } from "@upstash/redis";

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

// Lazy singleton
let _kv: Redis | null = null;
function kv(): Redis {
  if (!_kv) _kv = getRedis();
  return _kv;
}

export const kvKeys = {
  manifest: (filename: string) => `deck:${filename}:manifest`,
  token: (token: string) => `token:${token}`,
  request: (filename: string, id: string) => `request:${filename}:${id}`,
  adminSession: (id: string) => `admin:session:${id}`,
  manifestPattern: () => "deck:*:manifest",
};

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const value = await kv().get<T>(key);
  return value ?? null;
}

export async function kvSetJson<T>(key: string, value: T, opts?: { ex?: number }): Promise<void> {
  await kv().set(key, value, opts);
}

export async function kvDelete(key: string): Promise<void> {
  await kv().del(key);
}

export async function kvKeysByPattern(pattern: string): Promise<string[]> {
  const keys = await kv().keys<string[]>(pattern);
  return keys ?? [];
}
