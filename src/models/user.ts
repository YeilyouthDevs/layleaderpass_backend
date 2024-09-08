// models/user.model.js
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { pastDateRandomDelta } from "@/mocks/mockLib";
import {
  createMockAdminUserData,
  createMockGuestUserData,
  createMockUserData,
} from "@/mocks/userMock";
import { CountCacheService } from "@/services/countCacheService";
import bcrypt from 'bcrypt';
import { DataTypes, Model, Sequelize } from "sequelize";
import { DEV_ID, DEV_PW, isProduct } from "@/configs/envConfig";

export class User extends Model {
  declare email: string;
  declare password?: string;
  declare name?: string | null;
  declare phone?: string | null;
  declare birthday?: Date | null;
  declare role: UserRole;
  declare deleteConfirmAt?: Date | null;
  declare isDeleted: boolean | null;
  declare updatedBy?: string;
  declare acceptNo?: number;
  declare createdAt?: Date;
  declare updatedAt?: Date;
  declare deletedAt?: Date;
}

export type UserType = Partial<Omit<User, keyof Model>>;


export function initUser(sequelize: Sequelize) {
    User.init(
      {
        email: {
          type: DataTypes.STRING,
          primaryKey: true,
          comment: "이메일",
        },
        password: {
          type: DataTypes.STRING,
          allowNull: true,
          comment: "비밀번호",
        },
        name: {
          type: DataTypes.STRING,
          comment: "이름",
        },
        phone: {
          type: DataTypes.STRING,
          comment: "연락처",
        },
        birthday: {
          type: DataTypes.DATE,
          comment: "생일",
        },
        role: {
          type: DataTypes.ENUM,
          allowNull: false,
          values: Object.values(UserRole),
          defaultValue: UserRole.GUEST,
          comment: "역할(등급)",
        },
        isDeleted: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          comment: "삭제되었는지의 여부, 재가입이나 복원 시 true라면 사용자 정보 입력을 강제하도록 함",
        },
        deleteConfirmAt: {
          type: DataTypes.DATE,
          comment: "최종 삭제가 확정되는 날",
        },
        acceptNo: {
          type: DataTypes.INTEGER,
          comment: '가입승인 순서'
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
        tableName: "user",
        comment: "사용자를 나타내는 테이블",
        paranoid: true,
        indexes: [
          {
            name: "idx_createdAt",
            fields: [{ name: 'createdAt', order: 'DESC'}],
          },
          {
            name: "idx_name",
            fields: [{ name: 'name', order: 'ASC'}],
          },
          {
            name: 'idx_role',
            fields: ['role'],
          },
          {
            name: 'idx_valid_user',
            fields: ['deletedAt', 'role', 'isDeleted', 'createdAt']
          },
        ],
        hooks: {
          afterSync: async (options) => {

            //개발팀 계정
            const developerID = DEV_ID;
            const developerPW = bcrypt.hashSync(DEV_PW, bcrypt.genSaltSync());

            const superuser = await User.findByPk(developerID);
            if (!superuser) {
              await User.create({
                email: developerID,
                password: developerPW,
                name: "개발팀",
                birthday: new Date("2024-01-01T00:00:00+09:00"),
                phone: "01086550507",
                role: "ADMIN",
                talent: 0,
                acceptNo: 22,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
            }

            if (isProduct) return;

            const mockGuestUserData = createMockGuestUserData();
            const mockUserData = createMockUserData();
            const mockAdminUserData = createMockAdminUserData();

            const mockData = [
              ...mockUserData,
              ...mockAdminUserData,
              ...mockGuestUserData,
            ];

            let promises = [];
            let now = new Date();
            for (const user of mockData) {
              now = pastDateRandomDelta(now);
              
              user.createdAt = now;
              user.updatedAt = now;

              promises.push(User.create(user));
            }

            const allCounts = mockGuestUserData.length + mockUserData.length + mockAdminUserData.length + 1;

            promises = [...promises,
              CountCacheService.set(CountCacheKey.UNAPPROVED_USER, { value: mockGuestUserData.length }),
              CountCacheService.set(CountCacheKey.APPROVED_USER, { value: mockUserData.length + mockAdminUserData.length + 1 }), //개발팀 추가되므로 + 1
              CountCacheService.set(CountCacheKey.ALL_USER, { value: allCounts }),
            ]
            
            await Promise.allSettled(promises);
          },
        },
      }
    );
}
