// models/category.ts
import { DataTypes, Model, Sequelize } from "sequelize";

export class Category extends Model {
  declare id: number | null;
  declare categoryId: number | null;
  declare name: string | null;
  declare desc: string | null;
  declare updatedBy: string | null;
  declare createdAt: Date | null;
  declare updatedAt: Date | null;
  declare deletedAt: Date | null;
}

export type CategoryType = Partial<Omit<Category, keyof Model>>

export function initCategory(sequelize: Sequelize) {
    Category.init(
      {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          comment: "카테고리 이름",
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
        tableName: "category",
        comment: "중직자 카테고리를 나타내는 테이블",
        timestamps: true,
        indexes: [

        ],
        hooks: {
          afterSync: async (options) => {
            //기본값 할당

            const count = await Category.count();
            if (count > 0) return;

            const defaultData = [
              { id: 1, name: "복음가진 중직자" },
              { id: 2, name: "전도하는 중직자" },
              { id: 3, name: "선교하는 중직자" },
              { id: 4, name: "후대 세우는 중직자" },
              { id: 5, name: "교회 세우는 중직자" },
            ]

            let promises = [];
            for (const category of defaultData) {
              promises.push(Category.create(category));
            }
            
            await Promise.allSettled(promises);
          },
        },
      }
    );
}
