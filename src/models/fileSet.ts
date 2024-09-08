// models/fileSet.ts
import { DataTypes, Model, Sequelize } from "sequelize";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class FileSet extends Model {
  declare id: number;
  declare basePathKey: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export type FileSetType = Partial<Omit<FileSet, keyof Model>>;

export function initFileSet(sequelize: Sequelize) {

  FileSet.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          comment: 'FileSet의 ID, FileSet의 폴더명이 됨'
        },
        basePathKey: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: 'FileSet들이 존재하는 부모폴더의 절대경로 환경변수 키값'
        },
      },
      {
        sequelize,
        tableName: "file_set",
        comment: "파일셋을 나타내는 테이블",
        timestamps: true,
        indexes: [
          
        ],
        hooks: {
          afterSync: async (options) => {
            if (isProduct) return;

            await runSqlFile(sequelize, './src/mocks/fileSet.sql');
          },
        },
      }
    );
}
