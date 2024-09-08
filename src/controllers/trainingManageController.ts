import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { Pagination, PaginationRequest, PaginationResponse } from "@/lib/pagination";
import { setIf, switchOrder } from "@/lib/queryTools";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { TalentAssignment } from "@/models/talentAssignment";
import { TalentSum } from "@/models/talentSum";
import { User } from "@/models/user";
import { TalentService } from "@/services/talentService";
import { IndexHints, Op } from "sequelize";

export function enroll(){

    app.get('/api/trainingManage/list/talentGrant', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const { sort, searchBy, searchString, trainingId } = req.query as PaginationRequest | any;
    
            // 1. Fetch user data with pagination
            const userPageData = await Pagination.fetch(User, req.query as PaginationRequest, {
                attributes: ['email', 'name', 'birthday'],
                where: {
                    role: { [Op.ne]: UserRole.GUEST },
                    isDeleted: false,
                    ...setIf(searchBy === 'name' && searchString, {
                        name: { [Op.like]: `%${searchString}%` }
                    }),
                },
                indexHints: [{ type: IndexHints.FORCE, values: ['idx_valid_user'] }],
                order: [['name', 'ASC']],
                countCacheKey: !searchString ? CountCacheKey.APPROVED_USER : undefined
            });
    
            // 2. Fetch TalentSum data
            const userEmails = userPageData.data.map(user => user.email);
            const talentSums = await TalentSum.findAll({
                where: {
                    userEmail: { [Op.in]: userEmails },
                    trainingId: trainingId
                },
                attributes: ['userEmail', 'sum'],
                indexHints: [{ type: IndexHints.FORCE, values: ['idx_userEmail_trainingId']}]
            });
    
            // 3. Combine user data with TalentSum data
            const combinedData = userPageData.data.map(user => {
                const talentSum = talentSums.find(talent => talent.userEmail === user.email);
                return {
                    ...user.toJSON(),
                    talentSum: talentSum ? talentSum.sum : null
                };
            });
    
            // 4. Send final response with pagination meta
            const finalResponse: PaginationResponse<typeof combinedData[0]> = {
                data: combinedData,
                meta: userPageData.meta
            };
    
            rep.send(finalResponse);
    
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련 관리/달란트 지급 데이터를 불러오는 중 오류가 발생했습니다.'
            });
        }
    });

    app.get('/api/trainingManage/spec/talentGrant', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
      }, async (req, rep) => {
        try {
            const { id, trainingId } = req.query as any;
            
            const user = await User.findByPk(id, {
                attributes: ['email', 'name', 'phone', 'birthday'],
                include: [
                    {
                        model: TalentSum,
                        as: 'talentSums',
                        required: false,
                        attributes: ['sum'],
                        where: {
                            trainingId
                        }
                    }
                ]
            })

            rep.send(user);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.post('/api/trainingManage/work/talentGrant', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const { targets, trainingId, amount } = req.body as any;
            const { email: updater } = req.headers;
            ensureNotEmpty([targets, trainingId, amount, updater]);

            let results = [];

            for(const target of targets) {
                const result = await TalentService.grant(target, trainingId, amount, { updatedBy: updater as string })
                results.push(result);
            }

            rep.send(results);    
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '달란트 지급 중 오류 발생.'
            })
        }
        
    })

   
    /* 달란트 지급기록 */
    app.get('/api/trainingManage/list/talentAssignment', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const { sort, searchBy, searchString, trainingId } = req.query as any;

            let order = switchOrder(sort, [["createdAt", "DESC"]]);

            const pageData = await Pagination.fetch(TalentAssignment, req.query as PaginationRequest, {
                order,
                attributes: [ 'id', 'amount', 'createdAt' ],
                where: {
                    trainingId
                },
                include: [
                    {
                        model: User,
                        as: 'user', // 모델 관계 설정 시 정의한 alias
                        where: {
                            role: {
                                [Op.ne]: UserRole.GUEST
                            },
                            isDeleted: false,
                            ...setIf(searchBy === 'name', {
                                name: {
                                    [Op.like]: `%${searchString}%`
                                }
                            })
                        },
                        attributes: ['email', 'name'],
                    }
                ],
                indexHints: [{ type: IndexHints.FORCE, values: ['idx_talent_manage'] }],
                countIndexHint: [{ type: IndexHints.FORCE, values: ['idx_talent_manage'] }]
            })

            rep.send(pageData);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련 관리/지급 기록 목록 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })

    app.get('/api/trainingManage/spec/talentAssignment', { 
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
      }, async (req, rep) => {
        try {
            const { id } = req.query as any;
            
            const talentAssignment = await TalentAssignment.findByPk(id, {
                attributes: ['id', 'amount', 'updatedBy', 'createdAt'],
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['email', 'name'],
                        where: {
                            role: {
                                [Op.ne] : UserRole.GUEST
                            }
                        }
                    }
                ],
                // paranoid: false
            })

            rep.send(talentAssignment);

        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '훈련 관리/지급 기록 데이터를 불러오는 중 오류가 발생했습니다.'
            })
        }
    })


    //TODO 작업들 service 클래스로 옮기기
    app.put('/api/trainingManage/work/talentRevoke', {
        preHandler: [
            checkSession(), checkRole({ min: UserRole.ADMIN })
        ]
    }, async (req, rep) => {
        try {
            const { targets } = req.body as any;
            const { email: updater } = req.headers;
            ensureNotEmpty([targets, updater]);

            let results = [];

            for(const target of targets) {
                const result = await TalentService.revoke(target, { updatedBy: updater as string })
                results.push(result);
            }

            rep.send(results);    
        } catch (error) {
            ControlledError.catch(rep, error, {
                message: '달란트 회수 중 오류 발생.'
            })
        }

    })

}