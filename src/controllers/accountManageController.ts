// accountManageController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchOrder } from "@/lib/queryTools";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { User } from "@/models/user";
import { UserService } from "@/services/userService";
import { Op } from "sequelize";

export function enroll() {
  /**
   * 삭제된것 포함 전체 사용자 데이터 전송
   */
  app.get("/api/accountManage/list", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const query: PaginationRequest & any = req.query;
      const { sort, searchBy, searchString } = query;

      let order = switchOrder(sort, [['role', 'DESC'], ['name', 'ASC']], [
        { when: 'abc', order: [['name', 'ASC']] },
        { when: 'acceptNo', order: [['acceptNo', 'ASC']] },
      ]);

      // 캐시 키 선택
      let countCacheKey;
      if (sort === 'acceptNo') countCacheKey = CountCacheKey.APPROVED_USER;
      else if (!searchBy) countCacheKey = CountCacheKey.ALL_USER;

      const pageData = await Pagination.fetch(
        User,
        query as PaginationRequest,
        {
          countCacheKey,
          attributes: ["email", "name", "role", "deletedAt", "deleteConfirmAt", "acceptNo", "isDeleted"],
          where: {
            ...setIf(searchBy === 'name', {
              name: {
                [Op.like]: `%${searchString}%`,
              }
            }),
            ...setIf(sort === 'acceptNo', {
              role: {
                [Op.not]: UserRole.GUEST,
              }
            }),
          },
          paranoid: false,
          order,
        }
      );

      rep.send(pageData); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  app.get("/api/accountManage/spec", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { id } = req.query as any;

      if (!id) throw new Error("요청인자 부족");

      const user = await User.findByPk(id, {
        attributes: [
          "email",
          "name",
          "role",
          "createdAt",
          "updatedAt",
          "updatedBy",
          "deletedAt",
          "deleteConfirmAt",
          'acceptNo',
        ],
        paranoid: false
      });

      if (!user)
        throw new ControlledError({
          message: "삭제가 확정되어서 목록에 없는 유저입니다.",
          alertOptions: { type: "warn", duration: 2000 },
        });

      rep.send(user); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  app.put("/api/accountManage/changeRole", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { targetEmail, targetRole } = req.body as any;
      const { email: updatedBy } = req.headers as any;
      ensureNotEmpty([targetEmail, targetRole, updatedBy]);

      const result = await UserService.changeRole(targetEmail, targetRole, { updatedBy });
      rep.send([ result ]);

    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 역할을 변경하는 중 오류가 발생했습니다.",
      });
    }
  });

  app.put("/api/accountManage/delete", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { targets } = req.body as any;
      const { email: updatedBy } = req.headers as any;

      if (!targets || !updatedBy) throw new Error("요청인자 부족");

      let results = [];
            
      for(const target of targets) {
          const result = await UserService.delete(target, { updatedBy });    
          results.push(result);
      }

      rep.send(results);

    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 계정을 삭제하는 중 오류가 발생했습니다.",
      });
    }
  });

  app.put("/api/accountManage/deleteConfirm", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { targets } = req.body as any;
      const { email: updatedBy } = req.headers as any;

      if (!targets || !updatedBy) throw new Error("요청인자 부족");

      let results = [];
            
      for(const target of targets) {
          const result = await UserService.deleteConfirm(target, { updatedBy });    
          results.push(result);
      }

      rep.send(results);

    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 계정을 삭제 확정하는 중 오류가 발생했습니다.",
      });
    }
  });

  app.put("/api/accountManage/restore", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { targets } = req.body as any;
      const { email: updatedBy } = req.headers as any;

      if (!targets || !updatedBy) throw new Error("요청인자 부족");

      let results = [];
            
      for(const target of targets) {
          const result = await UserService.restore(target, { updatedBy });    
          results.push(result);
      }

      rep.send(results);

    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 계정을 복원하는 중 오류가 발생했습니다.",
      });
    }
  });

}
