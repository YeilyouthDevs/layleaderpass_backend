// homeController.ts

import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { HomeService } from "@/services/HomeService";


export function enroll() {

  app.get("/api/home/dashboard", {
    preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
  }, async (req, rep) => {
    try {
      const { email: userEmail } = req.headers as any;

      const result = await HomeService.loadDashboard(userEmail);
      
      rep.send(result); // 조회된 사용자 데이터 반환
    } catch (error) {
      ControlledError.catch(rep, error, {
        message: "그래프 데이터를 불러오는 중 오류가 발생했습니다.",
      });
    }
  });

}
