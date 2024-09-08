import { Service, ServiceOptions } from "@/lib/service";
import { ensureNotEmpty } from "@/lib/validation";
import { Training } from "@/models/training";
import { UserSubmission } from "@/models/userSubmission";
import { FastifyRequest } from "fastify";
import { Order, Transaction } from "sequelize";
import { TalentService } from "./talentService";
import { optionalModify, setIf, switchAs } from "@/lib/queryTools";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { TalentAssignment } from "@/models/talentAssignment";
import { ControlledError } from "@/controlledError";
import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { Op } from "sequelize";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";

export class SubmissionService {

    static async getList(req: FastifyRequest) {
        const { sort, searchBy, searchString, trainingId } = req.query as any;
        const { email: userEmail } = req.headers as any;
        ensureNotEmpty([userEmail]);
    
        // 날짜 범위 필터링을 위한 조건
        const dateRangeCondition: any = {};
        if (searchString && searchBy === 'date' && isValid(parseISO(searchString))) {
            const date = parseISO(searchString);
            dateRangeCondition[Op.between] = [startOfDay(date), endOfDay(date)];
        }
    
        const pageData = await Pagination.fetch(UserSubmission, req.query as PaginationRequest, {
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            attributes: ['id', 'confirm', 'createdAt'],
            include: [
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                }
            ],
            where: {
                trainingId,
                userEmail,
                ...setIf(searchString && searchBy === 'date', {
                    createdAt: dateRangeCondition
                })
            },
        });
    
        return pageData;
    }

    static async getSpec(req: FastifyRequest) {
        const { id } = req.query as any;
        ensureNotEmpty([ id ]);

        const userSubmission = await UserSubmission.findByPk(id, { 
            attributes: ['id', 'userEmail', 'fileSetId', 'content', 'reason', 'confirm', 'confirmedBy', 'confirmedAt', 'createdAt'],
            include: [
                {
                    model: TalentAssignment,
                    foreignKey: 'talentAssignmentId',
                    as: 'talentAssignment',
                    attributes: ['amount', 'updatedBy']
                },
            ]
        })

        if (!userSubmission) throw new ControlledError({
            message: '삭제되었거나 존재하지 않는 자료제출입니다.',
            alertOptions: { type: 'warn', duration: 3000 }
        })

        return userSubmission;
    }

    static async create(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);
    
            try {
                const { fileSetId, data } = await fileProcessor.save(req);
                const { trainingId, content } = data;
                const { email: whoSubmitted } = req.headers as any;
                ensureNotEmpty([ trainingId, whoSubmitted ]);
    
                const submission = {
                    trainingId, fileSetId, content, userEmail: whoSubmitted
                }
    
                //훈련이 유효한지 확인
                const training = await Training.findByPk(submission.trainingId!, {
                    attributes: ['id'], transaction
                })
    
                if (!training) throw Service.result({ status: false, message: '연관된 훈련이 삭제되었습니다.'});
    
                const created = await UserSubmission.create(submission, { transaction });
                await fileProcessor.finish();

                return Service.result({ status: true, id: created.id, message: '제출되었습니다.'});
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })

    }

    static async edit(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);
    
            try {
                const { fileSetId, data } = await fileProcessor.save(req);
                const { id, content, requestAgain, confirm } = data;
                ensureNotEmpty([ id ]);
    
                const userSubmission = await UserSubmission.findByPk(id, {
                    lock: Transaction.LOCK.UPDATE,
                    transaction 
                });
    
                if (!userSubmission) throw Service.result({ status: false, id: id, message: '이미 삭제된 자료제출입니다.' });
                if (userSubmission.confirm !== confirm) throw Service.result({ status: false, id: id, message: '이미 처리된 자료제출입니다.' });
    
                //훈련이 유효한지 확인
                const training = await Training.findByPk(userSubmission.trainingId!, {
                    attributes: ['id'],
                    transaction
                })
    
                if (!training) throw Service.result({ status: false, message: '연관된 훈련이 삭제되었습니다.' });
    
                await optionalModify({
                    targetInst: userSubmission,
                    changes: [
                        ['content', content],
                        ['fileSetId', fileSetId],
                        ...setIf(requestAgain, [
                            ['confirm', null],
                            ['confirmedBy', null],
                            ['confirmedAt', null],
                        ])
                    ],
                    onChanged: () => userSubmission.save({ transaction })
                });
                
                await fileProcessor.finish();

                return Service.result({ status: true, message: requestAgain ? '수정 후 재요청 되었습니다.' : '수정되었습니다.' })
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

    static async delete(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);
    
            try {
                const { submissionId } = req.body as any;
                const { email: whoSubmitted } = req.headers as any;
                ensureNotEmpty([submissionId, whoSubmitted]);
    
                const userSubmission = await UserSubmission.findByPk(submissionId, { 
                    attributes: ['id', 'userEmail', 'fileSetId', 'talentAssignmentId', 'confirm'],
                    transaction
                });
    
                if (!userSubmission) throw Service.result({ status: false, id: submissionId, message: '이미 삭제된 자료제출입니다.' });
                if (userSubmission.userEmail !== whoSubmitted) throw Service.result({ status: false, id: submissionId, message: '삭제 권한이 없습니다.' });
                if (userSubmission.confirm === true) throw Service.result({ status: false, id: submissionId, message: '이미 승인된 자료제출입니다.' });
    
                const fileSetId = userSubmission.fileSetId!;
                const talentAssignmentId = userSubmission.talentAssignmentId!;
    
                await userSubmission.destroy({ transaction });
    
                let promises = [
                    fileProcessor.destroy(fileSetId)
                ]
    
                if (talentAssignmentId) {
                    promises.push(TalentService.revoke(talentAssignmentId, { transaction, updatedBy: whoSubmitted }) as any)
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