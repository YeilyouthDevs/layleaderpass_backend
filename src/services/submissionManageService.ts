import { ControlledError } from "@/controlledError";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { ServiceOptions, Service } from "@/lib/service";
import { TalentAssignment } from "@/models/talentAssignment";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import { User } from "@/models/user";
import { confirmToBool, UserSubmission } from "@/models/userSubmission";
import { FastifyRequest } from "fastify";
import { IndexHints, Op, Order } from "sequelize";
import { UserRole } from '../enums/userRole';
import { TalentService } from "./talentService";
import { ensureNotEmpty } from "@/lib/validation";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";

export class SubmissionManageService {

    static async list(req: FastifyRequest) {
        const { sort, searchBy, searchString } = req.query as any;
        const { status } = req.params as any;
        ensureNotEmpty([ status ])

        let confirm = confirmToBool(status);

        const pageData = await Pagination.fetch(UserSubmission, req.query as PaginationRequest, {
            countCacheKey: undefined,
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            attributes: ['id', 'fileSetId', 'createdAt'],
            where: {
                confirm
            },
            include: [
                {
                    model: User,
                    as: 'user', // 모델 관계 설정 시 정의한 alias
                    where: {
                        role: {
                            [Op.ne]: UserRole.GUEST
                        },
                        ...setIf(searchString && searchBy === 'userName', {
                            name: { [Op.like]: `%${searchString}%` }
                        })
                    },
                    attributes: ['name', 'birthday'],
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                    required: true, //training type이 검색되지 않으면 상위 모델인 Training도 검색되지 않은 것으로 처리해서 쿼리결과를 없앰
                    where: {
                        ...setIf(searchString && searchBy === 'trainingTitle', {
                            title: { [Op.like]: `%${searchString}%` }
                        })
                    },
                    include: [{
                        model: TrainingType,
                        as: 'trainingType',
                        attributes: ['name'],
                        where: {
                            ...setIf(searchString && searchBy === 'trainingType', {
                                name: { [Op.like]: `%${searchString}%` }
                            })
                        },
                    }]
                }
            ],
            indexHints: [{ type: IndexHints.FORCE, values: ['idx_submission']}],
            countIndexHint: [{ type: IndexHints.FORCE, values: ['idx_submission']}]
        })

        return pageData;
    }

    static async spec(req: FastifyRequest) {
        const { id } = req.query as any;
        const { status } = req.params as any;
        ensureNotEmpty([ id, status ]);

        let confirm = confirmToBool(status);

        //자료제출 데이터 가져오기
        const userSubmission = await UserSubmission.findByPk(id, {
            attributes: ['id', 'fileSetId', 'content', 'confirm', 'reason', 'confirmedBy', 'confirmedAt', 'createdAt', 'talentAssignmentId'],
            include: [
                {
                    model: User,
                    as: 'user',
                    where: {
                        role: {
                            [Op.ne]: UserRole.GUEST
                        },
                    },
                    attributes: ['email', 'name', 'birthday'],
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['id', 'title'],
                    include: [
                        {
                            model: TrainingType,
                            as: 'trainingType',
                            attributes: ['name', 'desc', 'minTalent', 'maxTalent']
                        }
                    ]
                },
                {
                    model: TalentAssignment,
                    as: 'talentAssignment',
                    attributes: ['amount', 'updatedBy'],
                }
            ],
        }) as UserSubmission & {
            user: User,
            training: Training & {
                trainingType: TrainingType
            },
            talentAssignment: TalentAssignment
        };

        if (!userSubmission) throw new ControlledError({
            message: '이미 삭제된 자료제출입니다.',
            alertOptions: { type: 'fail', duration: 3000 }
        });

        if (userSubmission.confirm !== confirm) {
            throw new ControlledError ({
                message: '이미 처리된 자료제출입니다.',
                alertOptions: { type: 'warn', duration: 3000 }
            })
        }

        // 평탄화 작업 수행
        const data = {
            ...userSubmission.dataValues,
            user: userSubmission.user.dataValues,
            training: {
                ...userSubmission.training.dataValues,
                trainingType: userSubmission.training.trainingType.dataValues
            },
        };

        return data;
    }

    static async grant(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const { id, targetEmail, targetName, trainingId, amount } = req.body as any;
            const { email: updatedBy } = req.headers as any;

            ensureNotEmpty([id, targetEmail, trainingId, amount, updatedBy]);

            const talentAssignmentResult = await TalentService.grant(targetEmail, trainingId, amount, { transaction, updatedBy: options?.updatedBy });

            if (!talentAssignmentResult.status) {
                throw new ControlledError({
                    message: talentAssignmentResult.message,
                    alertOptions: {
                        type: 'warn',
                        duration: 3000
                    }
                })
            }

            const talentAssignmentId = talentAssignmentResult.payload.talentAssignmentId;
            const userSubmission = await UserSubmission.findByPk(id, { transaction });

            if (!userSubmission) throw Service.result({ status: false, id: id, message: '자료제출이 삭제되어 승인할 수 없습니다.' });
            if (userSubmission.confirm !== null) throw Service.result({ status: false, id: id, message: `이미 ${userSubmission.confirm ? '승인' : '거절'}된 자료제출입니다.` });

            userSubmission.confirm = true;
            userSubmission.talentAssignmentId = talentAssignmentId;
            userSubmission.confirmedBy = options?.updatedBy || updatedBy || 'SYSTEM';
            userSubmission.confirmedAt = new Date();

            await userSubmission.save({ transaction });
            return Service.result({ status: true, message: `${targetName} 에게 ${amount} 달란트가 지급되었습니다.` });
        })
    }

    static async reject(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const { id, reason } = req.body as any;
            const { email: updatedBy } = req.headers as any;

            ensureNotEmpty([id, reason, updatedBy]);

            const userSubmission = await UserSubmission.findByPk(id, { transaction });

            if (!userSubmission) throw Service.result({ status: false, id: id, message: '자료제출이 삭제되어 거절할 수 없습니다.' });
            if (userSubmission.confirm !== null) throw Service.result({ status: false, id: id, message: `이미 ${userSubmission.confirm ? '승인' : '거절'}된 자료제출입니다.` });

            userSubmission.confirm = false;
            userSubmission.reason = reason;
            userSubmission.confirmedBy = options?.updatedBy || updatedBy || 'SYSTEM';
            userSubmission.confirmedAt = new Date();

            await userSubmission.save({ transaction });
            return Service.result({ status: true, message: '거절되었습니다.' });
        })
    }

    static async revoke(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const { id } = req.body as any;
            const { email } = req.headers as any;

            ensureNotEmpty([id, email]);

            const userSubmission = await UserSubmission.findByPk(id, { transaction });

            if (!userSubmission) throw Service.result({ status: false, id: id, message: '자료제출이 삭제되어 승인 철회할 수 없습니다.' });
            if (userSubmission.confirm !== true) throw Service.result({ status: false, id: id, message: `이미 승인 철회된 자료제출입니다.` });

            const talentAssignmentId = userSubmission.talentAssignmentId;

            userSubmission.confirm = null;
            userSubmission.reason = null;
            userSubmission.confirmedBy = null;
            userSubmission.confirmedAt = null;
            userSubmission.talentAssignmentId = null;

            await userSubmission.save({ transaction });
            if (talentAssignmentId) await TalentService.revoke(talentAssignmentId, { transaction, updatedBy: options?.updatedBy });

            return Service.result({ status: true, message: '승인 철회되었습니다.' });
        })
    }

    
    static async delete(data: { id: number; }, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);
    
            try {
                const { id } = data;
    
                const userSubmission = await UserSubmission.findByPk(id, { 
                    attributes: ['id', 'fileSetId', 'talentAssignmentId', 'confirm'],
                    transaction
                });
    
                if (!userSubmission) throw Service.result({ status: false, id: id, message: '이미 삭제된 자료제출입니다.' });
                if (userSubmission.confirm === true) throw Service.result({ status: false, id: id, message: '이미 승인된 자료제출입니다.' });
    
                const fileSetId = userSubmission.fileSetId!;
                const talentAssignmentId = userSubmission.talentAssignmentId!;
    
                await userSubmission.destroy({ transaction });
    
                let promises = [
                    fileProcessor.destroy(fileSetId)
                ]
    
                if (talentAssignmentId) {
                    promises.push(TalentService.revoke(talentAssignmentId, { transaction, updatedBy: options?.updatedBy }) as any)
                }
    
                await Promise.all(promises);
                await fileProcessor.finish();
                return Service.result({ status: true, id: userSubmission.id!, message: '삭제되었습니다.' });
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

}