// models/countCache.ts
import { DataTypes, Model, Sequelize } from "sequelize";

export class CountCache extends Model {
  declare key: string;
  declare value: number;
}

export function initCountCache(sequelize: Sequelize) {
    CountCache.init(
      {
        key: {
          type: DataTypes.STRING,
          primaryKey: true,
          comment: "CountCache의 키 ID",
        },
        value: {
          type: DataTypes.INTEGER.UNSIGNED,
          comment: "캐시된 데이터의 개수",
        },
      },
      {
        sequelize,
        tableName: "count_cache",
        comment: "다른 테이블이나 특정 쿼리의 총 데이터 수를 캐싱하는 테이블",
        timestamps: false,
      }
    );

}
