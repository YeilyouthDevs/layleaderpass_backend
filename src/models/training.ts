// models/training.ts
import { isProduct } from "@/configs/envConfig";
import { runSqlFile } from "@/mocks/mockLib";
import { DataTypes, Model, Sequelize } from "sequelize";

export class Training extends Model {
  declare id: number | null;
  declare seasonId: number | null;
  declare trainingTypeId: number | null;
  declare fileSetId: number | null;
  declare title: string | null;
  declare content: string | null;
  declare submitStartAt: Date | null;
  declare submitEndAt: Date | null;
  declare startAt: Date | null;
  declare endAt: Date | null;
  declare createdBy: string | null;
  declare updatedBy: string | null;
  declare createdAt: Date | null;
  declare updatedAt: Date | null;
}

export type TrainingType = Partial<Omit<Training, keyof Model>>

export function initTraining(sequelize: Sequelize) {
  Training.init(
      {
        seasonId: {
          type: DataTypes.INTEGER,
          comment: "Season의 ID",
        },
        trainingTypeId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "TrainingType의 ID",
        },
        fileSetId: {
          type: DataTypes.INTEGER,
          comment: "FileSet의 ID",
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "제목"
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
          comment: '내용'
        },
        submitStartAt: {
          type: DataTypes.DATE,
          comment: '제출 시작일시'
        },
        submitEndAt: {
          type: DataTypes.DATE,
          comment: '제출 종료일시'
        },
        startAt: {
          type: DataTypes.DATE,
          comment: '훈련 시작일시'
        },
        endAt: {
          type: DataTypes.DATE,
          comment: '훈련 종료일시'
        },
        createdBy: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '훈련 최초 게시자'
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
        tableName: "training",
        comment: "훈련 타입을 기반으로 생성된 시즌별 훈련을 나타내는 테이블",
        timestamps: true,
        indexes: [
          {
            name: 'createdAt_startAt_endAt',
            fields: [
              { name: 'createdAt', order: 'DESC' },
              { name: 'startAt', order: 'DESC' },
              { name: 'endAt', order: 'DESC' },
            ],
          },
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/training.sql');
          },
        },
      }
    );
}