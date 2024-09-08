import { app } from "@/configs/fastifyConfig";
import { sequelize } from "@/configs/sequelizeConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";
import { Service } from "@/lib/service";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { Category } from "@/models/category";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import { AdminLogService } from "@/services/adminLogService";

export function enroll(){

    app.get('/api/static/categories', {
        preHandler: [checkSession(), checkRole({ min: UserRole.USER })]
      }, async (req, rep) => {
        try {
            const categories = await Category.findAll({
                attributes: ['id', 'name'],
                order: [['id', 'ASC']]
            });
            rep.send(categories);
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '카테고리 목록을 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.get('/api/static/trainingTypeInfo', {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    }, async (req, rep) => {
        const { id } = req.query as any;
        ensureNotEmpty([ id ]);

        const trainingType = await TrainingType.findByPk(id, {
            attributes: ['name', 'desc', 'minTalent', 'maxTalent']
        })

        rep.send(trainingType);
    })

    app.get('/api/static/trainingHeaderInfo', {
        preHandler: [ checkSession(), checkRole({ min: UserRole.USER }) ]
    }, async (req, rep) => {
        const { id } = req.query as any;
        ensureNotEmpty([ id ]);

        const trainingHeader = await Training.findByPk(id, {
            attributes: ['title', 'startAt', 'endAt']
        })

        rep.send(trainingHeader);
    })

    app.get('/api/static/adminLog', {
        preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
    }, async (req, rep) => {
        try {
            const pageData = await AdminLogService.getList(req);
            rep.send(pageData);    
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '관리자 로그를 불러오는 중 오류가 발생했습니다.'
            })
        }
        
    })

    app.post('/api/static/uploadByDevs', {
        preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
    }, async (req, rep) => {
        const transaction = await sequelize.transaction()
        const fileProcessor = new FileProcessor(transaction);

        try {
            await fileProcessor.save(req);
            const { email: createdBy } = req.headers as any;
            ensureNotEmpty([createdBy]);

            if (createdBy !== process.env.SU_ID) throw new Error('개발자 계정이 아님');

            await fileProcessor.finish();
            await transaction.commit();
            rep.send(Service.result({ status: true, message: '등록 되었습니다.' }))
        } catch (error) {
            await fileProcessor.reset();
            await transaction.rollback();

            rep.send(Service.result({ status: false, message: '오류 발생' })) 
        }
    })

}