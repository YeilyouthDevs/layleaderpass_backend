import { ControlledError } from "@/controlledError";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { TalentAssignment } from "@/models/talentAssignment";
import { TalentSum } from "@/models/talentSum";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import { FastifyRequest } from "fastify";
import { IndexHints, Op, Order } from "sequelize";

export class MyTalentAssignmentsService {

    static async list(req: FastifyRequest) {
        const { email: userEmail } = req.headers as any;
        const { sort, searchBy, searchString, categoryId, } = req.query as any;

        const pageData = await Pagination.fetch(TalentAssignment, req.query as PaginationRequest, {
            where: { userEmail },
            attributes: ['id', 'trainingId', 'amount', 'createdAt'],
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            include: [
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                    where: {
                        ...setIf(searchString && searchBy === 'title', {
                            title: {
                                [Op.like]: `%${searchString}%`
                            }
                        }),
                    },
                    include: [
                        ...setIf(!isNaN(categoryId) && categoryId !== 0, [
                            {
                                model: TrainingType,
                                as: 'trainingType',
                                attributes: ['id'],
                                required: true,
                                where: {
                                    categoryId: +categoryId
                                }
                            }
                        ])
                    ]   
                }
            ],
            indexHints: [{ type: IndexHints.FORCE, values: ['idx_userEmail_createdAt'] }],
            countIndexHint: [{ type: IndexHints.FORCE, values: ['idx_userEmail_createdAt'] }]
        })

        return pageData
    }

    static async spec(request: FastifyRequest) {
        const { email: userEmail } = request.headers as any;
        const { id } = request.query as any;

        const talentAssignment = await TalentAssignment.findByPk(id, {
            attributes: ['id', 'amount', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
            include: [
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
                }
            ],
        }) as TalentAssignment & {
            training: Training & {
                trainingType: TrainingType
            }
        }

        if (!talentAssignment) {
            throw new ControlledError({
                message: '삭제/회수된 달란트입니다.',
                alertOptions: { type: 'warn', duration: 3000 }
            })
        } 

        //훈련타입과 관련된 모든 달란트지급 합 구하기
        const trainingId = talentAssignment.training.id;

        const talentSum = await TalentSum.findOne({
            attributes: ['sum'],
            where: { trainingId, userEmail }
        })

        if (!talentSum) throw Error('달란트 합계 찾을 수 없음');

        talentAssignment.dataValues.sum = talentSum.sum;
        return talentAssignment;
    }

}