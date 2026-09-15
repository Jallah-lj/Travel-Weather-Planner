import json
import time
from typing import Any
from redis.asyncio import Redis
from app.core.config import get_settings

class CacheService:
    def __init__(self) -> None:
        self.settings = get_settings(); self.redis: Redis | None = None; self.memory: dict[str, tuple[float, Any]] = {}
    async def connect(self) -> None:
        try:
            candidate = Redis.from_url(self.settings.redis_url, decode_responses=True, socket_connect_timeout=3, socket_timeout=3)
            await candidate.ping(); self.redis = candidate
        except Exception:
            self.redis = None
            if self.settings.environment == "production": raise RuntimeError("Shared Redis unavailable; production cannot fall back to memory")
    async def close(self) -> None:
        if self.redis: await self.redis.aclose()
    async def get(self, key: str) -> Any | None:
        if self.redis:
            value = await self.redis.get(key); return json.loads(value) if value else None
        entry = self.memory.get(key)
        if not entry or entry[0] < time.time(): self.memory.pop(key, None); return None
        return entry[1]
    async def set(self, key: str, value: Any, ttl: int) -> None:
        if self.redis: await self.redis.setex(key, ttl, json.dumps(value, default=str)); return
        self.memory[key] = (time.time() + ttl, value)
    async def delete(self, key: str) -> None:
        if self.redis: await self.redis.delete(key)
        self.memory.pop(key, None)
    async def allow(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Fixed-window rate limit. Redis is atomic; memory is a development fallback."""
        if self.redis:
            count = int(await self.redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, window_seconds))
            return count <= limit, max(0, limit - count)
        if self.settings.environment == "production": raise RuntimeError("Shared rate limiter unavailable")
        now = time.time(); entry = self.memory.get(key)
        count = int(entry[1]) if entry and entry[0] >= now else 0
        count += 1; self.memory[key] = (now + window_seconds, count)
        return count <= limit, max(0, limit - count)

cache = CacheService()
