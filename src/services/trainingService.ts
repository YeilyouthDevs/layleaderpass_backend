import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { Service, ServiceOptions } from "@/lib/service";
import { ensureNotEmpty } from "@/lib/validation";
import { TalentAssignment } from "@/models/talentAssignment";
import { Training, TrainingType } from "@/models/training";
import { TrainingType as TrainingTypeModel } from "@/models/trainingType";
import { UserSubmission } from "@/models/userSubmission";
import { FastifyRequest } from "fastify";
import { Op, Order, Transaction } from "sequelize";
import { AdminLogService } from "./adminLogService";
import { CountCacheService } from "./countCacheService";
import { SeasonService } from "./seasonService";
import { TalentService } from "./talentService";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";

export class TrainingService {
    static async getList(req: FastifyRequest) {
        const { sort, searchBy, searchString } = req.query as any;
        const { tab } = req.params as any;

        switchAs<Order>(sort, {
            cases: [
                { when: "abc", then: [['title', 'ASC'], ['startAt', 'DESC'], ['endAt', 'DESC']] }
            ],
            default: [["startAt", "DESC"], ["endAt", "DESC"]]
        })

        const now = new Date();
        now.setSeconds(0);

        const pageData = await Pagination.fetch(
            Training,
            req.query as PaginationRequest,
            {
                order: switchAs<Order>(sort, {
                    cases: [
                        { when: "abc", then: [['title', 'ASC'], ['startAt', 'DESC'], ['endAt', 'DESC']] }
                    ],
                    default: [["startAt", "DESC"], ["endAt", "DESC"]]
                }),
                attributes: ["id", "title", "startAt", "endAt"],
                where: {
                    ...setIf(searchBy === "title", {
                        title: {
                            [Op.like]: `%${searchString}%`,
                        },
                    }),
                    ...setIf(tab === "available", {
                        //기한이 없거나 진행중인것들
                        [Op.or]: [
                            { startAt: null, endAt: null },
                            {
                                startAt: { [Op.lte]: now },
                                endAt: { [Op.gte]: now },
                            },
                        ],
                    }),
                    ...setIf(tab === "later", {
                        //진행예정훈련들
                        startAt: { [Op.gt]: now },
                        endAt: { [Op.gt]: now },
                    }),
                    ...setIf(tab === "over", {
                        //종료된 훈련들
                        startAt: { [Op.lt]: now },
                        endAt: { [Op.lt]: now },
                    }),
                },
            }
        );

        return pageData;
    }

    /**
     * 새 훈련을 생성함
     */
    static async create(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            const fileProcessor = new FileProcessor(transaction!);

            try {
                const { fileSetId, data: training } = await fileProcessor.save(req);
                const { email: updater } = req.headers;
    
                ensureNotEmpty([training, updater]);
                training.fileSetId = fileSetId;
    
                this.checkValidDate(training);
    
                //현재 시즌 가져오기
                const currentSeason = await SeasonService.getCurrentSeason();
                if (!currentSeason) throw Service.result({ status: false, message: '추가하려면 진행중인 시즌이 있어야합니다.'})
    
                training.seasonId = currentSeason.id;
                training.createdBy = training.updatedBy = updater;
    
                const created = await Training.create(training, { transaction });
    
                let promises = [
                    CountCacheService.increase(CountCacheKey.TRAINING, { transaction }),
                    AdminLogService.write(AdminLogAction.TRAINING_MANAGE, `훈련[${created.id}:${created.title}] 추가 `, { transaction, updatedBy: updater as string }),
                ];
    
                await Promise.all(promises);
                await fileProcessor.finish();
    
                // 생성
                return Service.result({ status: true, id: created.id, message: `훈련 ${created.title} 이(가) 추가되었습니다.`})
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
                const fileSaveResult = await fileProcessor.save(req);
    
                const { fileSetId, data } = fileSaveResult;
                const { id, updated } = data;
                const { email: updater } = req.headers;
    
                ensureNotEmpty([id, updated, updater]);
                updated.fileSetId = fileSetId;
    
                const original = await Training.findByPk(id, {
                    lock: Transaction.LOCK.UPDATE,
                    include: [
                        {
                            model: TrainingTypeModel,
                            foreignKey: "trainingTypeId",
                            as: "trainingType",
                            attributes: ["id"],
                        },
                    ],
                    transaction,
                }) as Training & {
                    trainingType: TrainingType
                };
    
                if (!original){
                    throw Service.result({ status: false, id: id, message: `이미 삭제된 훈련입니다.`})
                } else if (!original.trainingType){
                    throw Service.result({ status: false, id: id, message: `연관된 훈련타입이 존재하지 않습니다.`})
                }
    
                updated.updatedBy = updater;
    
                let promises = [
                    original.update(updated, { transaction }),
                    AdminLogService.write(AdminLogAction.TRAINING_MANAGE, `훈련[${original.id}:${updated.title || original.title}] 수정`, { updatedBy: updated.updatedBy }),
                ];

                this.checkValidDate(original);
    
                await Promise.all(promises);
                await fileProcessor.finish();

                return Service.result({ status: true, id: id, message: `훈련 ${updated.title || original.title} 이(가) 수정되었습니다.`})
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

    /**
     * 훈련을 삭제함
     */
    static async delete(id: number, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const trainingProcessor = new FileProcessor(transaction!);
            const userSubmissionProcessors: FileProcessor[] = [];

            try {
                const training = await Training.findByPk(id, {
                    lock: Transaction.LOCK.UPDATE,
                    include: [
                        {
                            model: UserSubmission,
                            as: "userSubmissions",
                            attributes: ["id", "fileSetId"],
                        },
                    ],
                    transaction,
                }) as Training & {
                    userSubmissions: UserSubmission[]
                };
    
                if (!training) throw Service.result({ status: false, id: id, message: "이미 삭제된 훈련입니다." });
    
                const deleteSubmissionTask = async (userSubmission: UserSubmission) => {
                    const userSubmissionProcessor = new FileProcessor(transaction!);
                    userSubmissionProcessors.push(userSubmissionProcessor);
                    await userSubmission.destroy({ transaction });
                    await userSubmissionProcessor.destroy(userSubmission.fileSetId);
                }

                // 사용자 제출 제거
                const rmUserSubmissionsProm = [];
                const userSubmissions = training.userSubmissions;
    
                for (const submission of userSubmissions) {
                    if (submission.fileSetId) {
                        rmUserSubmissionsProm.push(deleteSubmissionTask(submission));
                    }
                }
    
                await Promise.all(rmUserSubmissionsProm);

                // 훈련 파일셋 제거
                const trainingFileSetId = training.fileSetId!;
                await trainingProcessor.destroy(trainingFileSetId);
    
                // 훈련에서 지급된 달란트 모두 회수
                const talentAssignments = await TalentAssignment.findAll({
                    attributes: ["id"],
                    where: {
                        trainingId: training.id,
                    },
                    transaction,
                });

                const rmTalentAssignmentsProm = [];
    
                for (const talentAssignment of talentAssignments) {
                    rmTalentAssignmentsProm.push(
                        TalentService.revoke(talentAssignment.id!, { transaction, updatedBy: options?.updatedBy || 'SYSTEM' })
                    );
                }
    
                await Promise.all(rmTalentAssignmentsProm);
    
                const finalPromises = [
                    training.destroy({ transaction }),
                    CountCacheService.decrease(CountCacheKey.TRAINING, {
                        transaction,
                    }),
                    AdminLogService.write(AdminLogAction.TRAINING_MANAGE, `훈련[${training.id}:${training.title}] 삭제`, { transaction, updatedBy: options?.updatedBy || 'SYSTEM' }),
                ];
    
                await Promise.all(finalPromises);

                for (const fileProcessor of userSubmissionProcessors) await fileProcessor.finish();
                await trainingProcessor.finish()
                return Service.result({ status: true, id: id, message: `훈련 ${training.title} 이(가) 삭제되었습니다.` });
            } catch (error) {
                for (const fileProcessor of userSubmissionProcessors) await fileProcessor.reset();
                await trainingProcessor.reset();
                throw error;
            }
        })
    }

    private static checkValidDate(training: TrainingType) {
        if (
            (training.startAt && !training.endAt) ||
            (!training.startAt && training.endAt)
        ) {
            throw Service.result({ status: false, id: training.id!, message: '훈련 시작일시와 종료일시는 한 쌍으로 입력해야합니다.' });
        }

        if (
            (training.submitStartAt && !training.submitEndAt) ||
            (!training.submitStartAt && training.submitEndAt)
        ) {
            throw Service.result({ status: false, id: training.id!, message: '제출 시작일시와 종료일시는 한 쌍으로 입력해야합니다.' });
        }

        if (training.startAt && training.endAt) {
            if (new Date(training.startAt!) >= new Date(training.endAt!)) {
                throw Service.result({ status: false, id: training.id!, message: '훈련 종료일시가 훈련 시작일시와 같거나 빠를 수 없습니다.' });
            }
        }

        if (training.submitStartAt && training.submitEndAt) {
            if (
                new Date(training.submitStartAt!) >= new Date(training.submitEndAt!)
            ) {
                throw Service.result({ status: false, id: training.id!, message: '제출 종료일시가 제출 시작일시와 같거나 빠를 수 없습니다.' });
            }
        }
    }

    static async searchTrainingSelector(req: FastifyRequest) {
        const { trainingTitle } = req.query as any;
        if (!trainingTitle) return [];

        const trainings = await Training.findAll({
            attributes: ['id', 'title'],
            where: {
                title: {
                    [Op.like]: `%${trainingTitle}%`
                }
            }
        })

        return trainings;
    }
}
