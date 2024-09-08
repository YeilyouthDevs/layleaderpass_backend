import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { SeasonService } from "@/services/seasonService";

export function enroll(){

    app.get('/api/seasonManage/list', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const pageData = await SeasonService.getList(req);
            rep.send(pageData);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌 목록을 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.get('/api/seasonManage/spec', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const data = await SeasonService.getSpec(req);
            rep.send(data);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.post('/api/seasonManage/create', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const result = await SeasonService.create(req);
            rep.send([result]);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌을 추가하는 도중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/seasonManage/delete', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { targets } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([targets, updater])

            let results = []

            for (const target of targets){
                results.push(await SeasonService.delete(target, { updatedBy: updater as string}))
            }

            rep.send(results);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌을 삭제하는 중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/seasonManage/update', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { id, updated } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([id, updated, updater]);

            const result = await SeasonService.update(id, updated, { updatedBy: updater as string})

            rep.send([result]);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌을 수정하는 중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/seasonManage/start', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { id } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([id, updater]);

            const result = await SeasonService.start(id, { updatedBy: updater as string})

            rep.send([result]);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌을 시작하는 중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/seasonManage/end', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { id } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([id, updater]);

            const result = await SeasonService.end(id, { updatedBy: updater as string})

            rep.send([result]);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '시즌을 종료하는 중 오류가 발생했습니다.'
            })
        }
    })

}