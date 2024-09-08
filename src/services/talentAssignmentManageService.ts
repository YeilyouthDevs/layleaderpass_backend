import { ControlledError } from "@/controlledError";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { ensureNotEmpty } from "@/lib/validation";
import { TalentAssignment } from "@/models/talentAssignment";
import { Training } from "@/models/training";
import { TrainingType } from "@/models/trainingType";
import { User } from "@/models/user";
import { FastifyRequest } from "fastify";
import { Op, Order } from "sequelize";


export class TalentAssignmentManageService {
  
    static async getList(req: FastifyRequest){
        const { sort, searchBy, searchString } = req.query as any;

        const pageData = await Pagination.fetch(TalentAssignment, req.query as PaginationRequest, {
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            attributes: ['id', 'amount', 'createdAt'],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'name', 'birthday'],
                    where: {
                        ...setIf( searchString && searchBy === 'userName', { 
                            name: {
                                [Op.like]: `%${searchString}%`
                            }
                        }),
                    }
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['title'],
                    where: {
                        ...setIf(searchString && searchBy === 'trainingTitle', { 
                            title: {
                                [Op.like]: `%${searchString}%`
                            }
                        }),
                    }
                }
            ],
        })

        return pageData;
    }

    static async getSpec(req: FastifyRequest){

        const { id } = req.query as any;
        ensureNotEmpty([id]);

        const assignment = await TalentAssignment.findByPk(id, {
            attributes: ['id', 'amount', 'createdAt', 'createdBy'],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['email', 'name']
                },
                {
                    model: Training,
                    as: 'training',
                    attributes: ['id', 'title'],
                    include: [
                        {
                            model: TrainingType,
                            as: 'trainingType',
                            attributes: ['id', 'name', 'desc']
                        }
                    ]
                }
            ]
        })

        if (!assignment) {
            throw new ControlledError({
                message: '삭제된 달란트입니다.',
                alertOptions: { type: 'warn', duration: 3000 }
            })
        } 

        return assignment;
    }
 
}
