import { CountCache } from "@/models/countCache";
import { Transaction } from "sequelize";

export class CountCacheService {
  static async set(key: string, { value, transaction }: { value: number; transaction?: Transaction | null }) {
    const options = transaction ? { transaction } : {};
    // 기존 키가 있는지 확인하고, 있으면 업데이트, 없으면 생성
    await CountCache.upsert({ key, value }, options);
  }

  static async increase(key: string, { n = 1, transaction }: { n?: number; transaction?: Transaction | null } = {}) {
    const options = transaction ? { transaction } : {};
    // 키에 해당하는 값 찾기 또는 생성 (기본값 0)
    const [record, created] = await CountCache.findOrCreate({
      where: { key },
      defaults: { value: n },
      ...options
    });

    if (!created) {
      // 기존에 있던 키라면, 현재 값에 n 만큼 증가
      await record.increment('value', { by: n, ...options });
    }
  }

  static async decrease(key: string, { n = 1, transaction }: { n?: number; transaction?: Transaction | null } = {}) {
    const options = transaction ? { transaction } : {};
    // 키에 해당하는 값 찾기
    const record = await CountCache.findByPk(key, options);
    if (record) {
      // 현재 값에서 n 만큼 감소
      await record.decrement('value', { by: n, ...options });
    }
  }

  static async get(key: string) {
    const record = await CountCache.findByPk(key);
    return record ? record.value : 0; // 키에 해당하는 값이 없을 경우 null 반환
  }

}
