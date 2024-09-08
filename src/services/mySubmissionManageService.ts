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
import { SubmissionService } from "./submissionService";
import { TalentService } from "./talentService";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";

export class MySubmissionManageService {

    static async list(req: FastifyRequest) {
        const { sort, searchBy, searchString } = req.query as any;
        const { status } = req.params as any;
        const { email: userEmail } = req.headers as any;

        let confirm = confirmToBool(status);

        const pageData = await Pagination.fetch(UserSubmission, req.query as PaginationRequest, {
            countCacheKey: undefined,
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            attributes: [ 'id', 'fileSetId', 'createdAt' ],
            where: { confirm, userEmail },
            include: [
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                    where: {
                        ...setIf(searchBy === 'trainingTitle', {
                            title: { [Op.like]: `%${searchString}%` }
                        })
                    },
                }
            ],
            indexHints: [{ type: IndexHints.FORCE, values: ['idx_submission'] }],
            countIndexHint: [{ type: IndexHints.FORCE, values: ['idx_submission'] }]
        })

        return pageData;
    }

    static async spec(req: FastifyRequest) {
        const { id } = req.query as any;
        const { status } = req.params as any;

        //자료제출 데이터 가져오기
        const userSubmission = await UserSubmission.findByPk(id, {
            attributes: [ 'id', 'fileSetId', 'content', 'confirm', 'reason', 'confirmedBy', 'confirmedAt', 'createdAt' ],
            include: [
                {
                    model: User,
                    as: 'user', 
                    where: {
                        role: { [Op.ne]: UserRole.GUEST },
                    },
                    attributes: ['email', 'name', 'birthday'],
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['id', 'title', 'startAt', 'endAt'],
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

        if (!userSubmission) {
            throw new ControlledError({
                message: '이미 삭제된 자료제출입니다.',
                alertOptions: { type: 'fail', duration: 3000 }
            })
        }

        let confirm = confirmToBool(status);
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

    static async edit(req: FastifyRequest, options?: ServiceOptions) {
        return await SubmissionService.edit(req, options);
    }

    static async revoke(data: { submissionId: number; }, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);
    
            try {
                const { submissionId } = data;
    
                const userSubmission = await UserSubmission.findByPk(submissionId, { 
                    attributes: ['id', 'fileSetId', 'talentAssignmentId', 'confirm'],
                    transaction 
                });
    
                if (!userSubmission) throw Service.result({ status: false, id: submissionId, message: '이미 삭제된 자료제출입니다.' });
                if (userSubmission.confirm !== null) throw Service.result({ status: false, id: submissionId, message: `이미 ${userSubmission.confirm ? '승인' : '거절'}된 자료제출입니다.` });
    
                const fileSetId = userSubmission.fileSetId!;
                const talentAssignmentId = userSubmission.talentAssignmentId!;
    
                // 삭제 작업을 Promise 배열로 수집
                let promises = [
                    userSubmission.destroy({ transaction }),
                    fileProcessor.destroy(fileSetId)
                ];
    
                // talentAssignmentId가 있는 경우 추가 작업
                if (talentAssignmentId) {
                    promises.push(TalentService.revoke(talentAssignmentId, { transaction, updatedBy: options?.updatedBy }) as any);
                }
    
                await Promise.all(promises);
                await fileProcessor.finish();
                return Service.result({ status: true, id: userSubmission.id!, message: '삭제되었습니다.' });
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        });
    }

}