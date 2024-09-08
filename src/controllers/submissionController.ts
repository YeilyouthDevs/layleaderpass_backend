import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { SubmissionService } from "@/services/submissionService";



export function enroll() {

    app.get('/api/submission/list', 
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {
        try {
            const pageData = await SubmissionService.getList(req);
            rep.send(pageData);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '인증자료 제출 기록을 불러오는 중 오류 발생'
            })
        }
    })

    app.get('/api/submission/spec', 
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {

        try {
            const data = await SubmissionService.getSpec(req);
            rep.send(data);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '인증자료 제출 데이터를 불러오는 중 오류 발생'
            })
        }
    })

    app.post('/api/submission/create',
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {

        try {
            const result = await SubmissionService.create(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 등록 중 오류 발생'
            })
        }

    })

    app.post('/api/submission/edit',
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {

        try {
            const result = await SubmissionService.edit(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '자료제출 수정 중 오류 발생'
            })
        }

    })

    app.post('/api/submission/delete',
        {
            preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
        },
        async (req, rep) => {
    
            try {
                const result = await SubmissionService.delete(req);
                rep.send(result);
            } catch (error) {
                ControlledError.catch(rep, error, {
                    message: '자료제출 삭제 중 오류 발생'
                })
            }
    
        })

}