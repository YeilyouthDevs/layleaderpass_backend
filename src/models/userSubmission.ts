// models/userSubmission.ts
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class UserSubmission extends Model {
  declare id: number;
  declare userEmail: string;
  declare trainingId: number;
  declare fileSetId: number | null;
  declare talentAssignmentId: number | null;
  declare content: string;
  declare confirm: boolean | null;
  declare reason: string | null;
  declare confirmedBy: string | null;
  declare confirmedAt: Date | null;
  declare createdAt: Date;
}

export type UserSubmissionType = Partial<Omit<UserSubmission, keyof Model>>;

export function initUserSubmission(sequelize: Sequelize) {

  UserSubmission.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
          comment: 'ID'
        },
        userEmail: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: '제출한 사용자의 이메일',
        },
        trainingId: {
          type: DataTypes.INTEGER,
          comment: '연관된 훈련 ID',
        },
        fileSetId: {
          type: DataTypes.INTEGER,
          comment: '제출 FileSet ID',
        },
        talentAssignmentId: {
          type: DataTypes.INTEGER,
          comment: '달란트 지급 ID',
          references: {
            model: 'talent_assignment',
            key: 'id'
          }
        },
        content: {
          type: DataTypes.TEXT,
          comment: '사용자가 입력한 내용'
        },
        confirm: {
          type: DataTypes.BOOLEAN,
          comment: '승인/거절 여부'
        },
        reason: {  
          type: DataTypes.STRING,
          comment: '거절에 대한 관리자의 이유'
        },
        confirmedBy: {
          type: DataTypes.STRING,
          comment: '승인한 관리자의 이메일'
        },
        confirmedAt: {
          type: DataTypes.DATE,
          comment: '승인/거절 처리한 시간'
        }
      },
      {
        sequelize,
        tableName: "user_submission",
        comment: "사용자의 제출을 나타내는 테이블",
        updatedAt: false,
        indexes: [
          {
            name: 'idx_submission',
            fields: ['confirm', 'createdAt', 'trainingId', 'userEmail']
          }
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, '/src/mocks/userSubmission.sql');
          },
        },
      }
    );
}

export function confirmToBool(status: 'standby' | 'approved' | 'rejected'){
  let confirm: boolean | null;

  switch (status) {
      case 'standby': confirm = null; break;
      case 'approved': confirm = true; break;
      case 'rejected': confirm = false; break;
      default: throw new Error('status 올바르지 않음');
  }

  return confirm;
}