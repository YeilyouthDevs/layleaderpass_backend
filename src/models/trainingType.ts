// models/trainingSchema.ts
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";


export class TrainingType extends Model {
  declare id: number | null;
  declare categoryId: number | null;
  declare name: string | null;
  declare desc: string | null;
  declare minTalent: number | null;
  declare maxTalent: number | null;
  declare updatedBy: string | null;
  declare createdAt: Date | null;
  declare updatedAt: Date | null;
}

export type TrainingTypeType = Partial<Omit<TrainingType, keyof Model>>

export function initTrainingType(sequelize: Sequelize) {
    TrainingType.init(
      {
        categoryId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "소속된 Category의 ID",
          references: { model: 'category', key: 'id' }
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "훈련타입 이름",
        },
        desc: {
          type: DataTypes.TEXT,
          allowNull: true,
          comment: "훈련타입 설명",
        },
        minTalent: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: '시즌 내 해당 훈련타입을 통해 획득해야하는 최소 달란트 수'
        },
        maxTalent: {
          type: DataTypes.INTEGER,
          allowNull: true,
          comment: '시즌 내 해당 훈련타입을 통해 획득가능한 최대 달란트 수'
        },
        updatedBy: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "SYSTEM",
          comment: "최종 수정자의 이메일",
        },
      },
      {
        sequelize,
        tableName: "training_type",
        comment: "훈련타입를 나타내는 테이블",
        timestamps: true,
        indexes: [
          {
            name: 'idx_categoryId',
            fields: ['categoryId']
          },
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/trainingType.sql');
          },
        },
      }
    );
}
