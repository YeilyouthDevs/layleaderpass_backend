import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { TalentAssignment } from "@/models/talentAssignment";
import { User } from "@/models/user";
import { FastifyRequest } from "fastify";
import { Op, Order, where } from "sequelize";
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { Training } from "@/models/training";
import sequelize from "sequelize";
import { TalentSum } from "@/models/talentSum";
import { TrainingType } from "@/models/trainingType";


export class TalentAssignmentManageService {
    static async getRevokeList(req: FastifyRequest){
        const { sort, searchBy, searchString, searchStartDate, searchEndDate, trainingId } = req.query as any;

        const pageData = await Pagination.fetch(TalentAssignment, req.query as PaginationRequest, {
            order: switchAs<Order>(sort, {
                cases: [
                    { when: 'oldest', then: [['createdAt', 'ASC']] },
                    { when: 'userName', then: [[sequelize.col('user.name'), 'ASC']] },
                    { when: 'trainingName', then: [[sequelize.col('training.title'), 'ASC']] }
                ],
                default: [['createdAt', 'DESC']]
            }),
            attributes: ['id', 'amount', 'createdAt', 'createdBy'],
            where: {
                ...setIf(searchStartDate || searchEndDate, {
                    createdAt: {
                        ...setIf(searchStartDate, {
                            [Op.gte]: searchStartDate    
                        }),
                        ...setIf(searchEndDate, {
                            [Op.lte]: searchEndDate,    
                        })
                    }
                }),
                ...setIf(trainingId, {
                    trainingId: trainingId
                }),
                ...setIf(searchString && searchBy === 'userEmail', {
                    userEmail: searchString
                }),
                ...setIf(searchString && searchBy === 'granterEmail', {
                    createdBy: searchString
                })
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'name'],
                    where: {
                        ...setIf(searchString && searchBy === 'userName', {
                            name: searchString
                        })
                    }
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: ['email', 'name'],
                    where: {
                        ...setIf(searchString && searchBy === 'granterName', {
                            name: searchString
                        })
                    },
                    required: !!(searchString && searchBy === 'granterName'), // 조건에 맞는 경우에만 JOIN 
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                }
            ]
        })

        return pageData;
    }

    static async getByTrainList(req: FastifyRequest) {
        const { sort, searchBy, searchString, trainingId } = req.query as any;
    
        const pageData = await Pagination.fetch(User, req.query as PaginationRequest, {
            countCacheKey: (searchString && searchBy) ? undefined : CountCacheKey.APPROVED_USER,
            order: switchAs<Order>(sort, {
                cases: [
                    { when: 'talent', then:  [['talent', 'DESC'], ['name', 'ASC']] },
                ],
                default: [['name', 'ASC']]
            }),
            attributes: [
                'email', 
                'name', 
                'birthday',
                'talent'
            ],
            where: {
                role: {
                    [Op.ne]: UserRole.GUEST
                },
                ...setIf(searchString && searchBy === 'userName', {
                    name: {
                        [Op.like]: `%${searchString}%`
                    }
                })
            },
            ...setIf(trainingId, {
                include: [
                    {
                        model: TalentSum,
                        as: 'talentSums',
                        attributes: ['sum'], //TODO ???? sum값을 합치지도 않았는데 합쳐져서 나온다... 이게 왜 되는거지 상황.. 알아보기..
                        where: {
                            trainingId
                        },
                        required: false
                    }
                ],
            }),
            raw: true,
            nest: true,
        });

        return pageData;
    }

    static async getByUserList(req: FastifyRequest) {
        const { sort, searchBy, searchString, userEmail } = req.query as any;
    
        const pageData = await Pagination.fetch(Training, req.query as PaginationRequest, {
            countCacheKey: (searchString && searchBy) ? undefined : CountCacheKey.TRAINING,
            order: switchAs<Order>(sort, {
                cases: [
                    // { when: 'talent', then:  [['talent', 'DESC'], ['name', 'ASC']] },
                ],
                default: [['title', 'ASC']]
            }),
            attributes: [
                'id',
                'title', 
                'startAt', 
                'endAt',
            ],
            where: {
                ...setIf(searchBy === "title", {
                    title: {
                        [Op.like]: `%${searchString}%`,
                    },
                })
            }
        });

        return pageData;
    }

    

    // static async getSpec(req: FastifyRequest){

    //     const { id } = req.query as any;
    //     ensureNotEmpty([id]);

    //     const assignment = await TalentAssignment.findByPk(id, {
    //         attributes: ['id', 'amount', 'createdAt', 'createdBy'],
    //         include: [
    //             {
    //                 model: User,
    //                 as: 'user',
    //                 attributes: ['email', 'name']
    //             },
    //             {
    //                 model: Training,
    //                 as: 'training',
    //                 attributes: ['id', 'title'],
    //                 include: [
    //                     {
    //                         model: TrainingType,
    //                         as: 'trainingType',
    //                         attributes: ['id', 'name', 'desc']
    //                     }
    //                 ]
    //             }
    //         ]
    //     })

    //     if (!assignment) {
    //         throw new ControlledError({
    //             message: '삭제된 달란트입니다.',
    //             alertOptions: { type: 'warn', duration: 3000 }
    //         })
    //     } 

    //     return assignment;
    // }
 
}
