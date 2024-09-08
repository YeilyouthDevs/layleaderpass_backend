// mySubmissionManageController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { MySubmissionManageService } from "@/services/mySubmissionManageService";


export function enroll() {

  app.get("/api/mySubmissionManage/list/:status", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      const pageData = await MySubmissionManageService.list(req);
      rep.send(pageData); 
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "자료제출 목록을 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

  app.get("/api/mySubmissionManage/spec/:status", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      let data = await MySubmissionManageService.spec(req);
      rep.send(data);
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "데이터를 불러오는 중 오류가 발생했습니다.",
      });
    }
  })

  app.post("/api/mySubmissionManage/edit", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      let result = await MySubmissionManageService.edit(req);
      rep.send(result);
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "자료제출을 수정하는 중 오류가 발생했습니다.",
      });
    }
  })

  app.post("/api/mySubmissionManage/revoke", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      const { submissionId } = req.body as any;
      const { email } = req.headers as any;

      let result = await MySubmissionManageService.revoke({ submissionId }, { updatedBy: email });
      rep.send(result); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "자료제출을 취소하는 중 오류가 발생했습니다.",
      });
    }
  })

}
