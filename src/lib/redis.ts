// utils/redisUtil.js

import { redisInst } from "@/configs/redisConfig";

async function setHash(key: string, object: any, expire = null) {
  try {
    await redisInst.hmset(key, object);
    if (expire == null) {
      await redisInst.persist(key);
    } else {
      await redisInst.expire(key, expire);
    }
  } catch (err) {
    console.error("setHash 오류 발생:", err);
  }
}

/**
 * 패턴에 맞는 키들을 순회하며 작업하는 메소드
 * @param pattern 키 패턴
 * @param handler 키를 받아 작업할 핸들러
 * @example
 * ```
 * await scanAsync('myPattern:*', async (key) => {
 *     const condition = checkCondition(key);
 *     if (condition) return true;  //바로 종료
 * });
```
 * @returns 
 */
async function scanAsync(
  pattern: string,
  handler: (key: string) => Promise<boolean | void>
) {
  const stream = redisInst.scanStream({
    match: pattern,
    count: 100,
  });

  return new Promise((resolve, reject) => {
    const keysToProcess: string[] = [];

    stream.on("data", (keys) => {
      keysToProcess.push(...keys);
    });

    stream.on("end", async () => {
      try {
        for (const key of keysToProcess) {
          const shouldStop = await handler(key);
          if (shouldStop) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      } catch (err) {
        reject(err);
      }
    });

    stream.on("error", (err) => reject(err));
  });
}

async function countKeys(pattern: string) {
  const stream = redisInst.scanStream({
    match: pattern,
    count: 100,
  });

  let keyCount = 0;

  stream.on("data", (keys) => {
    keyCount += keys.length;
  });

  return new Promise((resolve, reject) => {
    stream.on("end", () => {
      resolve(keyCount);
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

async function deleteAllByPattern(pattern: string) {
  try {
    await scanAsync(pattern, async (key) => {
      redisInst.del(key);
    });
  } catch (error) {
    console.error(`패턴에 맞는 모든 키 삭제 도중 오류 발생, 패턴: ${pattern}`);
    throw error;
  }
}

interface MaintainKeyCountOptions {
  timestamp?: string | Buffer;
  operateType?: "get" | "hash" | "zset";
}

/**
 * 오래된 키를 삭제하는 메소드
 * 
 * @example
```
// 특정 필드값을 기준으로 오래된순 삭제
await redisUtil.tool.maintainKeyCount(createSessionKey(email), 2, {
  timestamp: 'ts', operateType: 'hash'
})

// 만료시간을 기준으로 오래된 순 삭제 (기본 동작)
await redisUtil.tool.maintainKeyCount(createEmailAuthTokenKey(email), 2)
```
 * @param {string} pattern 
 * @param {number} limit 
 * @param {MaintainKeyCountOptions} options 
 */
async function maintainKeyCount(
  pattern: string,
  limit: number,
  options: MaintainKeyCountOptions = {}
): Promise<void> {
  try {
    const { timestamp = null, operateType = null } = options;

    let keysAndTimestamps: Array<{ key: string; timestamp: number }> = [];

    // 키와 타임스탬프를 가져오기
    await scanAsync(pattern, async (key) => {
      let timestampValue: string | number | null = null;

      if (operateType === "get") {
        timestampValue = await redisInst.get(key);
      } else if (timestamp === null) {
        timestampValue = await redisInst.ttl(key); // TTL 경우
      } else if (operateType === "hash") {
        timestampValue = await redisInst.hget(key, timestamp);
      } else if (operateType === "zset") {
        timestampValue = await redisInst.zscore(key, timestamp);
      }

      // 숫자로 변환하고, 유효하지 않은 경우 제외
      const parsedTimestamp = parseInt(timestampValue as string, 10);

      if (!isNaN(parsedTimestamp)) {
        keysAndTimestamps.push({ key, timestamp: parsedTimestamp });
      }
    });

    // 타임스탬프로 정렬 (오래된 순)
    if (timestamp === null) {
      keysAndTimestamps.sort((a, b) => b.timestamp - a.timestamp);
    } else {
      keysAndTimestamps.sort((a, b) => a.timestamp - b.timestamp);
    }

    // 제한 초과 키 삭제
    for (let i = limit; i < keysAndTimestamps.length; i++) {
      await redisInst.del(keysAndTimestamps[i].key);
    }
  } catch (error) {
    console.error("키 유지 관리 중 오류 발생:", error);
    throw error;
  }
}

const redis = {
  inst: redisInst,
  tool: {
    setHash: setHash,
    scanAsync: scanAsync,
    countKeys: countKeys,
    deleteAllByPattern: deleteAllByPattern,
    maintainKeyCount: maintainKeyCount,
  },
};

export default redis;
