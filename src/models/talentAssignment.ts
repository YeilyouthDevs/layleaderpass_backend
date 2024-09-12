// models/talentAssignment.ts
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class TalentAssignment extends Model {
  declare id: number | null;
  declare trainingId: number | null;
  declare userEmail: string | null;
  declare amount: number | null;
  declare updatedBy: string | null;
  declare createdAt: Date | null;
  declare updatedAt: Date | null;
  declare deletedAt: Date | null;
}

export type TalentAssignmentType = Partial<Omit<TalentAssignment, keyof Model>>

export function initTalentAssignment(sequelize: Sequelize) {
  TalentAssignment.init(
      {
        trainingId: {
          type: DataTypes.INTEGER,
          comment: "Training의 ID",
        },
        userEmail: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "User의 Email",
          references: { model: 'user', key: 'email' }
        },
        amount: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: "지급 달란트 양",
        },
        createdBy: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '지급자 Email',
        },
        updatedBy: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "달란트를 지급한 관리자의 Email",
        },
      },
      {
        sequelize,
        tableName: "talent_assignment",
        comment: "사용자가 훈련공지를 통해 달란트를 부여받는 것을 나타내는 테이블",
        timestamps: true,
        paranoid: false,
        indexes: [
          {
            name: 'idx_userEmail_createdAt',
            fields: ['userEmail', 'createdAt'],
          },
          {
            name: 'idx_talent_manage',
            fields: ['trainingId', 'createdAt'],
          },
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/talentAssignment.sql');
          },
        },
      }
    );
}