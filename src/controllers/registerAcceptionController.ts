// userController.ts

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
   * 회원가입 승인/거절 미 승인자 리스트 전송
   */
  app.get("/api/regAccept/list", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const query: PaginationRequest & any = req.query;
      const { sort, searchBy, searchString } = query;

      let order = switchOrder(sort, [['name', 'ASC']], [
        { when: 'latest', order: [['createdAt', 'DESC']] }
      ]);

      const pageData = await Pagination.fetch(
        User,
        query as PaginationRequest,
        {
          countCacheKey: searchBy ? undefined : CountCacheKey.UNAPPROVED_USER,
          attributes: ["email", "name", "birthday"],
          where: {
            role: UserRole.GUEST,
            acceptNo: null,
            ...setIf(searchBy === 'name', {
              name: {
                [Op.like]: `%${searchString}%`,
              }
            })
          },
          order
        }
      );

      rep.send(pageData); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  /**
   * 사용자 상세보기
   */
  app.get("/api/regAccept/spec", {
    preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
  }, async (req, rep) => {
    try {
      const { id } = req.query as any;

      if (!id) throw new Error("요청인자 부족");

      const user = await User.findOne({
        attributes: [
          "email",
          "name",
          "birthday",
          "phone",
          "createdAt",
          "updatedAt",
          "updatedBy",
        ],
        where: {
          email: id,
          role: UserRole.GUEST,
        },
      });

      if (!user)
        throw new ControlledError({
          message: "이미 처리되어 목록에 없는 유저입니다.",
          alertOptions: { type: "warn", duration: 2000 },
        });

      rep.send(user); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

   /**
   * 승인 또는 거절
   */
    app.put("/api/regAccept/confirm", {
      preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
    }, async (req, rep) => {
        try {
            const { targets, confirm } = req.body as any;
            const { email: updater } = req.headers;
            ensureNotEmpty([targets, confirm, updater])

            let results = [];
            
            for(const target of targets) {
                const result = await UserService.confirmRegister(target, confirm, { updatedBy: updater as string });    
                results.push(result);
            }

            rep.send(results);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: "사용자 목록을 불러오는 중 오류가 발생했습니다.",
            });
        }
    });
}
