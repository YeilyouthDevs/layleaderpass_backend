import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { TalentAssignmentManageService } from "@/services/talentAssignmentManageService";

export function enroll() {

    app.get(
        "/api/talentAssignmentManage/list/:tab",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                const { tab } = req.params as any;

                let pageData;

                if (tab === 'byTrain') {
                    pageData = await TalentAssignmentManageService.getByTrainList(req);
                } else if (tab === 'byUser') {
                    pageData = await TalentAssignmentManageService.getByUserList(req);
                } else if (tab === 'revoke') {
                    pageData = await TalentAssignmentManageService.getRevokeList(req);
                }

                rep.send(pageData)
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "달란트 지급 목록을 가져오는 중 오류 발생",
                });
            }
        }
    );

    app.get(
        "/api/talentAssignmentManage/spec",
        {
            preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })],
        },
        async (req, rep) => {
            try {
                // const data = await TalentAssignmentManageService.getSpec(req);
                // rep.send(data)
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: "달란트 지급 데이터를 가져오는 중 오류 발생",
                });
            }
        }
    );
   
}
