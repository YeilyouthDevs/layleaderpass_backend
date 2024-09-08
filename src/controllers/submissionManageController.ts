import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { SubmissionManageService } from "@/services/submissionManageService";

export function enroll(){


    app.get('/api/submissionManage/list/:status', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const pageData = await SubmissionManageService.list(req);
            rep.send(pageData);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련 관리/제출자료 검증 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    
    app.get('/api/submissionManage/spec/:status', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const data = await SubmissionManageService.spec(req);
            rep.send(data);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 데이터를 불러오는 중 오류가 발생했습니다.'
            });
        }
    });

    app.post('/api/submissionManage/grant', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const result = await SubmissionManageService.grant(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 승인 중 오류가 발생했습니다.'
            });
        }
    });

    app.post('/api/submissionManage/reject', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const result = await SubmissionManageService.reject(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 거절 중 오류가 발생했습니다.'
            });
        }
    });

    app.post('/api/submissionManage/revoke', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
          const result = await SubmissionManageService.revoke(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 승인 철회 중 오류가 발생했습니다.'
            });
        }
    });

    app.post('/api/submissionManage/delete', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const { id } = req.body as any;
            const { email } = req.headers as any;

            ensureNotEmpty([id, email]);

            const result = await SubmissionManageService.delete({ id }, { updatedBy: email });
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 삭제 중 오류가 발생했습니다.'
            });
        }
    });
    

}