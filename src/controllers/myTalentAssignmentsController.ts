// mySubmissionManageController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { MyTalentAssignmentsService } from "@/services/myTalentAssignmentsService";


export function enroll() {

  app.get("/api/myTalentAssignments/list", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      const pageData = await MyTalentAssignmentsService.list(req);
      rep.send(pageData); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "내 달란트 지급목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  app.get("/api/myTalentAssignments/spec", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      let data = await MyTalentAssignmentsService.spec(req);
      rep.send(data); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "내 달란트 지급 상세보기 데이터를 불러오는 중 오류가 발생했습니다.",
      });
    }
  })

}
