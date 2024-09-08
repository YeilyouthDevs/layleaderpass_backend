import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchOrder } from "@/lib/queryTools";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { Category } from "@/models/category";
import { TrainingType } from "@/models/trainingType";
import { TrainingTypeService } from "@/services/trainingTypeService";
import { Op } from "sequelize";

export function enroll(){

    app.get('/api/trainingTypeManage/list', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { sort, searchBy, searchString } = req.query as any;

            let order = switchOrder(sort, [['categoryId', 'ASC'], ['name', 'ASC']], [
                { when: 'latest', order: [['createdAt', 'DESC']] }
            ]);

            const pageData = await Pagination.fetch(TrainingType, req.query as PaginationRequest, {
                countCacheKey: searchBy ? undefined : CountCacheKey.TRAINING_TYPE,
                order,
                attributes: [
                    'id', 'name'
                ],
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['name'],
                    }
                ],
                where: {
                    ...setIf(searchBy === 'name', {
                        name: {
                            [Op.like]: `%${searchString}%`
                        }
                    })
                }
            })

            rep.send(pageData);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련타입 목록을 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.get('/api/trainingTypeManage/spec', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { id } = req.query as any;
            
            const trainingSchema = await TrainingType.findByPk(id, {
                attributes: ['id', 'categoryId', 'name', 'desc', 'minTalent', 'maxTalent', 'createdAt', 'updatedAt', 'updatedBy'],
                include: [
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['name']
                    }
                ],
            })

            rep.send(trainingSchema);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련타입 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.post('/api/trainingTypeManage/create', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { training } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([training, updater]);

            const result = await TrainingTypeService.create(training, { updatedBy: updater as string })

            rep.send([result]);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련타입을 추가하는 도중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/trainingTypeManage/delete', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { targets } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([targets, updater]);

            let results = []

            for (const target of targets){
                results.push(await TrainingTypeService.delete(target, { updatedBy: updater as string }))
            }

            rep.send(results);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련타입을 삭제하는 도중 오류가 발생했습니다.'
            })
        }
    })

    app.put('/api/trainingTypeManage/update', {
        preHandler: [checkSession(), checkRole({ min: UserRole.ADMIN })]
      }, async (req, rep) => {
        try {
            const { id, updated } = req.body as any;
            const { email: updater } = req.headers;

            ensureNotEmpty([id, updated, updater]);

            const result = await TrainingTypeService.update(id, updated, { updatedBy: updater as string })

            rep.send([result]);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련타입을 수정하는 도중 오류가 발생했습니다.'
            })
        }
    })
    

}