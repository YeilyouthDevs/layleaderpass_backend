// models/countCache.ts
import { AdminLogAction } from "@/enums/adminLogAction";
import { DataTypes, Model, Sequelize } from "sequelize";

export class AdminLog extends Model {
  declare id: number;
  declare action: AdminLogAction;
  declare message: number;
  declare createdAt: Date;
}

export function initAdminLog(sequelize: Sequelize) {
    AdminLog.init(
      {
        action: {
          type: DataTypes.ENUM,
          values: Object.keys(AdminLogAction),
          comment: "관리자의 활동 종류",
        },
        updatedBy: {
          type: DataTypes.STRING,
          comment: "작업을 처리한 관리자",
        },
        message: {
          type: DataTypes.STRING,
          comment: "메세지",
        },
      },
      {
        sequelize,
        tableName: "admin_log",
        comment: "관리자의 활동로그를 기록하는 테이블",
        updatedAt: false,
        indexes: [
          {
            name: 'idx_createdAt',
            fields: [{ name: 'createdAt', order: 'DESC' }]
          }
        ] 
      }
    );
}
