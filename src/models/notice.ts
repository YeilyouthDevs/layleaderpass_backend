// models/notice.ts
import { NoticeLevel } from "@/enums/noticeLevel";
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class Notice extends Model {
  declare id?: number;
  declare level?: NoticeLevel;
  declare fileSetId?: number;
  declare title?: string;
  declare content?: string;
  declare authorEmail?: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
  declare updatedBy?: string;
}

export type NoticeType = Partial<Omit<Notice, keyof Model>>;

export function initNotice(sequelize: Sequelize) {
    Notice.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          comment: "ID",
        },
        level: {
          type: DataTypes.INTEGER,
          allowNull: false,
          comment: "공지레벨",
        },
        fileSetId: {
          type: DataTypes.INTEGER,
          comment: "첨부파일 세트 ID",
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "제목",
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false,
          comment: "내용",
        },
        createdBy: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "작성자 이메일",
        },
        updatedBy: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "최종 수정자의 이메일",
        },
      },
      {
        sequelize,
        tableName: "notice",
        comment: "공지사항을 나타내는 테이블",
        indexes: [
          { fields: ['createdAt'] },
          {
            fields: [
              { name: 'level', order: 'DESC' },
              { name: 'createdAt', order: 'DESC' },
            ]
          },
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/notice.sql');
          },
        },
      }
    );
}
