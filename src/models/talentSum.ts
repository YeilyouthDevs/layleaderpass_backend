// models/talentSum.ts
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class TalentSum extends Model {
  declare id: number | null;
  declare trainingId: number | null;
  declare userEmail: string | null;
  declare sum: number | null;
  declare createdAt: Date | null;
}

export type TrainingSchemaType = Partial<Omit<TalentSum, keyof Model>>

export function initTalentSum(sequelize: Sequelize) {
  TalentSum.init(
      {
        trainingId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "Training의 ID",
        },
        userEmail: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "User의 Email",
        },
        sum: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "시즌별 해당 훈련을 통해 획득한 달란트 총합",
        },
      },
      {
        sequelize,
        tableName: "talent_sum",
        comment: "사용자가 특정 시즌 특정 훈련에서 얻은 총 달란트를 나타내는 테이블",
        indexes: [
          {
            name: 'idx_userEmail_trainingId',
            fields: ['userEmail', 'trainingId'],
          },
          {
            name: 'idx_userEmail',
            fields: ['userEmail'],
          }
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/talentSum.sql');
          },
        },
      }
    );
}
