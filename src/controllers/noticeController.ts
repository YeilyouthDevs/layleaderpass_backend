import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { NoticeService } from "@/services/noticeService";

export function enroll() {

    app.get('/api/notice/list/:level', 
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {
        try {
            const pageData = await NoticeService.getList(req);
            rep.send(pageData);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '공지사항 목록을 불러오는 중 오류 발생'
            })
        }
    })

    app.get('/api/notice/spec', 
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {
        try {
            const data = await NoticeService.getSpec(req);
            rep.send(data);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '공지사항 데이터를 불러오는 중 오류 발생'
            })
        }
    })

    app.post('/api/notice/create',
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
    },
    async (req, rep) => {

        try {
            const result = await NoticeService.create(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '공지사항 등록 중 오류 발생'
            })
        }

    })

    app.post('/api/notice/delete',
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
    },
    async (req, rep) => {

        try {
            const { targets } = req.body as any;
            const { email: adminEmail } = req.headers as any;
            ensureNotEmpty([targets, adminEmail]);

            let results = [];

            for ( const target of targets ) {
                results.push(await NoticeService.delete(target, { updatedBy: adminEmail }));
            }

            rep.send(results);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '공지사항 등록 중 오류 발생'
            })
        }

    })

    app.post('/api/notice/edit',
    {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    },
    async (req, rep) => {

        try {
            const result = await NoticeService.edit(req);
            rep.send(result);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '공지사항 수정 중 오류 발생'
            })
        }

    })

}