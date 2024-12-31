import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { Service, ServiceOptions } from "@/lib/service";
import { TrainingType, TrainingTypeType } from "@/models/trainingType";
import { FindOptions, Op, Transaction } from "sequelize";
import { AdminLogService } from "./adminLogService";
import { CountCacheService } from "./countCacheService";
import { Training } from "@/models/training";
import { TrainingService } from "./trainingService";

export class TrainingTypeService {
    /**
     * 새 훈련타입을 생성함
     */
    static async create(training: TrainingTypeType, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const updatedBy = options?.updatedBy || "SYSTEM";
            training.updatedBy = updatedBy;

            const created = await TrainingType.create(training, {
                transaction,
            });

            let promises = [
                CountCacheService.increase(CountCacheKey.TRAINING_TYPE, {
                    transaction,
                }),
                AdminLogService.write(
                    AdminLogAction.TRAINING_TYPE_MANAGE,
                    `훈련타입[${created.id}:${created.name}] 추가`,
                    { transaction, updatedBy }
                ),
            ];

            await Promise.all(promises);

            // 생성
            return Service.result({
                status: true,
                id: created.id,
                message: `훈련타입 ${training.name} 이(가) 추가되었습니다.`,
            });
        });
    }

    /**
     * 훈련타입을 삭제함
     */
    static async delete(id: number, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const trainingType = await TrainingType.findByPk(id, {
                lock: Transaction.LOCK.UPDATE,
                include: [
                    {
                        model: Training,
                        as: "trainings",
                        attributes: ["id"],
                    },
                ],
                transaction,
            });

            if (!trainingType)
                throw Service.result({
                    status: false,
                    id: id,
                    message: "이미 삭제된 훈련타입입니다.",
                });

            //연관된 훈련 삭제
            const trainings = (trainingType as any).trainings;
            const updatedBy = options?.updatedBy || "SYSTEM";

            for (const training of trainings) {
                await TrainingService.delete(training.id, {
                    transaction,
                    updatedBy,
                });
            }

            let promises = [
                trainingType.destroy({ transaction }),
                CountCacheService.decrease(CountCacheKey.TRAINING_TYPE, {
                    transaction,
                }),
                AdminLogService.write(
                    AdminLogAction.TRAINING_TYPE_MANAGE,
                    `훈련타입[${trainingType.id}:${trainingType.name}] 삭제`,
                    { transaction, updatedBy }
                ),
            ];

            await Promise.all(promises);

            return Service.result({
                status: true,
                id: id,
                message: `훈련타입 ${trainingType.name} 이(가) 삭제되었습니다.`,
            });
        });
    }

    /**
     * 훈련타입을 수정함
     */
    static async update(id: number, updated: TrainingTypeType, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const original = await TrainingType.findByPk(id, {
                lock: Transaction.LOCK.UPDATE,
                transaction,
            });

            if (!original)
                throw Service.result({
                    status: false,
                    id: id,
                    message: "이미 삭제된 훈련타입입니다.",
                });

            updated.updatedBy = options?.updatedBy || "SYSTEM";

            let promises = [
                original.update(updated, {
                    fields: [
                        "name",
                        "categoryId",
                        "desc",
                        "minTalent",
                        "maxTalent",
                    ],
                    transaction,
                }),
                AdminLogService.write(
                    AdminLogAction.TRAINING_TYPE_MANAGE,
                    `훈련타입[${original.id}:${
                        updated.name || original.name
                    }] 수정`,
                    { transaction, updatedBy: updated.updatedBy }
                ),
            ];

            await Promise.all(promises);

            return Service.result({
                status: true,
                id: id,
                message: `훈련타입 ${
                    updated.name || original.name
                } 이(가) 수정되었습니다.`,
            });
        });
    }

    /**
     * 훈련타입을 검색함
     */
    static async serachAllByName(searchString: string, options: FindOptions = {}) {
        const data = await TrainingType.findAll({
            where: {
                name: {
                    [Op.like]: `%${searchString}%`,
                },
            },
            ...options,
        });

        return data;
    }
}
