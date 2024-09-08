// models/file.ts
import fs from 'fs-extra';
import { DataTypes, Model, Sequelize } from "sequelize";
import { FileSet } from "./fileSet";
import { runSqlFile } from "@/mocks/mockLib";
import { isProduct } from "@/configs/envConfig";

export class File extends Model {
  declare id: number | null;
  declare fileSetId: number | null;
  declare originId: number | null;
  declare order: number | null;
  declare isImage: boolean | null;
  declare saveName: string | null;
  declare originalName: string | null;
  declare extension: string | null;
  declare createdAt: Date | null;
}

export type FileType = Partial<Omit<File, keyof Model>>;

export function initFile(sequelize: Sequelize) {

  File.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        comment: "File의 ID, File이 저장될 때 ID값으로 이름이 바뀜",
      },
      fileSetId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "연관된 FileSet을 나타내는 ID",
        references: { model: FileSet, key: FileSet.primaryKeyAttribute },
      },
      originId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "썸네일파일인 경우 값이 있음, 원본 이미지파일을 나타냄",
        references: { model: 'file', key: 'id' }, // 자기참조
      },
      isImage: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '이미지 파일인경우'
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "파일의 순서를 나타냄, 썸네일과 이미지는 같은값의 순서를 가짐",
      },
      saveName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "File의 업로드 시 변경하는 이름",
      },
      originalName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "File의 원본 이름",
      },
      extension: {
        type: DataTypes.STRING,
        comment: "파일의 확장자",
      },
    },
    {
      sequelize,
      tableName: "file",
      comment: "파일을 나타내는 테이블",
      updatedAt: false,
      indexes: [
        {
          name: "fileSetId",
          fields: ["fileSetId"],
        },
      ],
      hooks: {

        afterSync: async (options) => {
          if (isProduct) return;

          await runSqlFile(sequelize, './src/mocks/file.sql');

          // 테스트 파일 복사
          await fs.copy('./files/test_source', './files/data');
        },
      },
    }
  );
}
