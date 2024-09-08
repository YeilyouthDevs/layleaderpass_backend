// models/user.model.js
import { isProduct } from "@/configs/envConfig";
import { runSqlFile } from "@/mocks/mockLib";
import { DataTypes, Model, Sequelize } from "sequelize";

export class Season extends Model {
  declare id: number;
  declare name: string;
  declare startDate: Date;
  declare endDate: Date;
  declare cursor: boolean | null;
  declare updatedBy: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export type SeasonType = Partial<Omit<Season, keyof Model>>

export function initSeason(sequelize: Sequelize) {
  Season.init(
      {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "시즌 이름",
        },
        startDate: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: "시즌 시작일",
        },
        endDate: {
          type: DataTypes.DATE,
          allowNull: false,
          comment: "시즌 종료일",
        },
        cursor: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          comment: "현재 진행중인 시즌을 나타내는 커서",
        },
        updatedBy: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: "SYSTEM",
          comment: "최종 수정자의 이메일",
        },
      },
      {
        sequelize,
        tableName: "season",
        comment: "시즌을 나타내는 테이블",
        timestamps: true,
        indexes: [
          {
            name: 'idx_startDate',
            fields: ["createdAt"],
          },
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/season.sql');
          },
        },
      }
    );
}
