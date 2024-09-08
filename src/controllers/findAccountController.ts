// findAccountController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { checkTurnstile } from "@/middlewares/checkTurnstile";
import { FindAccountService } from "@/services/FindAccountService";

export function enroll() {

  app.post("/api/findAccount/email", {
    preHandler: [checkTurnstile]
  }, async (req, rep) => {
    try {
      const result = await FindAccountService.findEmail(req);
      rep.send(result);
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "이메일 찾기 중 오류가 발생했습니다.",
      });
    }
  });


  app.post("/api/findAccount/sendPasswordResetMail", {
      preHandler: [checkTurnstile]
    }, async (req, rep) => {
      try {
        const result = await FindAccountService.sendPasswordResetMail(req);
        rep.send(result);
      } catch (error) {
        ControlledError.catch(rep, error, {
          message: "비밀번호 재설정 메일 전송 중 오류가 발생했습니다.",
        });
      }
    });

  app.post("/api/findAccount/checkPasswordResetToken", async (req, rep) => {
    try {
      const result = await FindAccountService.checkPasswordResetToken(req);
      rep.send(result);
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "비밀번호 재설정 토큰 확인 중 오류가 발생했습니다.",
      });
    }
  });

  app.post("/api/findAccount/submitPasswordResetForm", async (req, rep) => {
    try {
      const result = await FindAccountService.submitPasswordResetForm(req);
      rep.send(result);
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "비밀번호 재설정 중 오류가 발생했습니다.",
      });
    }
  });
}
