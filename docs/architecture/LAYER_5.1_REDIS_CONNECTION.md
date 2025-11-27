# Layer 5.1: Redis Connection

> IORedis client configuration, connection events, health monitoring

## Overview

Redis serves as the message broker for BullMQ job queues. Both the queue (producer) and worker (consumer) maintain separate Redis connections with event handling for connection state monitoring. The connection uses IORedis with specific configuration for BullMQ compatibility.

**Key Responsibilities:**
- Configure IORedis client for BullMQ
- Handle connection lifecycle events
- Monitor connection health
- Provide consistent connection across queue and worker

---

## The Problem

Without proper Redis connection management:

```typescript
// WRONG: Default Redis client without BullMQ config
const redis = new Redis();
// BullMQ requires maxRetriesPerRequest: null

// WRONG: No connection monitoring
const queue = new Queue('jobs', { connection: redis });
// No way to know if Redis is down

// WRONG: Shared connection
const worker = new Worker('jobs', handler, { connection: queue.client });
// Workers need their own connection instance

// WRONG: No graceful handling
redis.on('error', () => {});  // Silent failure
// System fails without any visibility
```

**Our Solution:**
1. IORedis with `maxRetriesPerRequest: null` for BullMQ
2. Connection event listeners for monitoring
3. Separate connections for queue and worker
4. Emoji-prefixed logging for visibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS CONNECTIONS                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Redis Server                          │    │
│  │                    localhost:6379                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                        │                                         │
│         ┌──────────────┼──────────────┐                         │
│         │              │              │                         │
│         ▼              ▼              ▼                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Queue     │ │ QueueEvents │ │   Worker    │                │
│  │ Connection  │ │ Connection  │ │ Connection  │                │
│  │             │ │             │ │             │                │
│  │ (Producer)  │ │ (Listener)  │ │ (Consumer)  │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│         │              │              │                         │
│         ▼              ▼              ▼                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Event Handlers                         │    │
│  │                                                          │    │
│  │  • connect   → ✅ [Queue/Worker] Redis connected        │    │
│  │  • error     → ❌ [Queue/Worker] Redis error: ...       │    │
│  │  • close     → ⚠️  [Worker] Redis connection closed      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/queues/image-queue.ts` | Queue-side Redis connection |
| `server/workers/image-worker.ts` | Worker-side Redis connection |

---

## Core Implementation

### Queue Connection (Producer)

```typescript
// server/queues/image-queue.ts
import Redis from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,  // Required for BullMQ
});

// Connection event monitoring
connection.on("connect", () => {
  console.log("✅ [Queue] Redis connected");
});

connection.on("error", (err) => {
  console.error("❌ [Queue] Redis error:", err.message);
});
```

### Worker Connection (Consumer)

```typescript
// server/workers/image-worker.ts
import Redis from "ioredis";

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,  // Required for BullMQ
});

// Extended event monitoring
redisConnection.on("connect", () => {
  console.log("✅ [Worker] Redis connected");
});

redisConnection.on("error", (err) => {
  console.error("❌ [Worker] Redis error:", err.message);
});

redisConnection.on("close", () => {
  console.log("⚠️  [Worker] Redis connection closed");
});
```

### Environment Variables

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Connection Options

```typescript
const connectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),

  // BullMQ requirement - allows blocking operations
  maxRetriesPerRequest: null,

  // Optional: Connection retry strategy
  retryStrategy: (times: number) => {
    if (times > 10) {
      console.error("Redis connection failed after 10 retries");
      return null;  // Stop retrying
    }
    return Math.min(times * 100, 3000);  // Exponential backoff, max 3s
  },

  // Optional: Connection pool settings
  lazyConnect: false,  // Connect immediately
  enableReadyCheck: true,
};
```

---

## Design Decisions

### Why maxRetriesPerRequest: null?

```typescript
maxRetriesPerRequest: null
```

**Reasons:**
1. **BullMQ blocking operations** - BLPOP/BRPOP need to wait indefinitely
2. **Long-running jobs** - Jobs can take minutes to complete
3. **Prevents timeout errors** - Default would throw after retries exhausted
4. **Official requirement** - BullMQ documentation specifies this

### Why Separate Connections?

```typescript
// Queue has its own
const queueConnection = new Redis({ ... });
export const imageQueue = new Queue('image-processing', { connection: queueConnection });

// Worker has its own
const workerConnection = new Redis({ ... });
const worker = new Worker('image-processing', handler, { connection: workerConnection });
```

**Reasons:**
1. **Blocking operations** - Worker blocks on BRPOP, can't share
2. **Connection isolation** - Queue failure doesn't affect worker
3. **Scaling** - Multiple workers each need their own connection
4. **BullMQ architecture** - Designed for separate connections

### Why IORedis over redis?

```typescript
import Redis from "ioredis";  // Not 'redis'
```

**Reasons:**
1. **BullMQ default** - Built for IORedis
2. **Better TypeScript** - First-class TS support
3. **Cluster support** - Native Redis Cluster support
4. **Performance** - Pipelining, connection pooling

### Why Event Logging?

```typescript
connection.on("connect", () => {
  console.log("✅ [Queue] Redis connected");
});
```

**Reasons:**
1. **Visibility** - Know when connection established
2. **Debugging** - See connection state in logs
3. **Monitoring** - Can alert on connection loss
4. **Emoji prefix** - Quick visual scanning of logs

---

## Integration Points

| Connects To | How |
|-------------|-----|
| Layer 5.2 (Queue) | Queue uses connection for job dispatch |
| Layer 5.3 (Worker) | Worker uses connection for job fetching |
| Layer 5.5 (Retry) | Connection errors trigger retry logic |
| External (Redis) | TCP connection to Redis server |

### Health Check Endpoint

```typescript
// server/routes/health.ts
import { imageQueue } from "../queues/image-queue";

router.get("/health/redis", async (req, res) => {
  try {
    // Ping Redis through queue connection
    const client = await imageQueue.client;
    await client.ping();

    res.json({
      status: "healthy",
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || "6379",
        connected: true,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      redis: { connected: false, error: error.message },
    });
  }
});
```

---

## Common Issues / Debugging

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Cause:** Redis not running.

**Fix:**

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### maxRetriesPerRequest Error

```
Error: Job stalled or queue went offline
```

**Cause:** Missing `maxRetriesPerRequest: null`.

**Fix:** Add to connection options:

```typescript
const connection = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,  // Add this
});
```

### Connection Timeout

```
Error: Connection timeout
```

**Cause:** Wrong host/port or firewall.

**Debug:**

```bash
# Test connection
redis-cli -h localhost -p 6379 ping
# Should return: PONG

# Check if Redis is listening
netstat -an | grep 6379
```

### Too Many Connections

```
Error: ERR max number of clients reached
```

**Cause:** Not closing connections or too many workers.

**Debug:**

```bash
redis-cli info clients
# Check connected_clients count
```

**Fix:** Configure Redis maxclients or reduce workers.

### Silent Connection Loss

```
// No error logs, but jobs not processing
```

**Cause:** Connection closed without event.

**Fix:** Add reconnect strategy:

```typescript
const connection = new Redis({
  ...options,
  retryStrategy: (times) => {
    console.warn(`Redis reconnect attempt ${times}`);
    return Math.min(times * 100, 3000);
  },
});
```

---

## Further Reading

- [Layer 5.2: Queue Definition](./LAYER_5.2_QUEUE_DEFINITION.md) - Queue setup
- [Layer 5.3: Worker Lifecycle](./LAYER_5.3_WORKER_LIFECYCLE.md) - Worker connection usage
- [BullMQ Connection Docs](https://docs.bullmq.io/guide/connections)
- [IORedis Documentation](https://github.com/redis/ioredis)
