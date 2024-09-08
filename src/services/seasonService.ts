import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { formatDatetime } from "@/lib/date";
import { Service, ServiceOptions } from "@/lib/service";
import { Season, SeasonType } from "@/models/season";
import { isWithinInterval } from 'date-fns';
import { Op, Order, Transaction } from "sequelize";
import { AdminLogService } from "./adminLogService";
import { CountCacheService } from "./countCacheService";
import { FastifyRequest } from "fastify";
import { ensureNotEmpty } from "@/lib/validation";
import { setIf, switchAs } from "@/lib/queryTools";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { ControlledError } from "@/controlledError";

export class SeasonService {

    static async getList(req: FastifyRequest) {
        const query = req.query as PaginationRequest;
        const { sort, searchBy, searchString } = query;

        const pageData = await Pagination.fetch(Season, query, {
            countCacheKey: searchBy ? undefined : CountCacheKey.SEASON,
            order: switchAs<Order>(sort, {
                cases: [
                    { when: 'latest', then: [['createdAt', 'DESC']]}
                ],
                default: [['startDate', 'DESC']]
            }),
            attributes: [
                'id', 'name', 'startDate', 'endDate', 'cursor'
            ],
            where: {
                ...setIf(searchString && searchBy === 'name', {
                    name: {
                        [Op.like]: `%${searchString}%`
                    }
                })
            }
        })

        return pageData;
    }

    static async getSpec(req: FastifyRequest) {
        const { id } = req.query as any;
        ensureNotEmpty([ id ]);
        
        const season = await Season.findByPk(id, {
            attributes: ['id', 'name', 'startDate', 'endDate', 'cursor', 'updatedAt', 'updatedBy'],
        })

        if (!season) throw new ControlledError({
            message: '이미 삭제된 시즌입니다.',
            alertOptions: { type: 'warn', duration: 3000 }
        });

        return season;
    }

    static async getCurrentSeason(){
        const currentSeason = await Season.findOne({
            where: {
                cursor: true
            },
            attributes: ['id'],
        })

        return currentSeason;
    }
  
    static async create(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

        const { name, startDate, endDate } = req.body as any;
            const { email: updatedBy } = req.headers;
            ensureNotEmpty([name, startDate, endDate, updatedBy]);

            const season = { name, startDate, endDate, updatedBy } as SeasonType;

            // 기존 시즌과 겹치는 날짜가 있는지 확인
            await this.checkOverlapAndValidSeason(season, { transaction });

            const created = await Season.create(season, { transaction });
            
            let promises = [
                CountCacheService.increase(CountCacheKey.SEASON, { transaction }),
                AdminLogService.write(AdminLogAction.SEASON_MANAGE, `시즌[${created.id}:${created.name}] 추가`, { transaction, updatedBy: created.updatedBy })
            ]

            await Promise.all(promises);
            return Service.result({ status: true, id: created.id, message: `시즌 ${season.name} 이(가) 추가되었습니다.`});
        });
    }

  static async delete(id: number, options?: ServiceOptions) {
    return await Service.handler(options, async (transaction) => {

        const season = await Season.findByPk(id, { transaction });

        if (!season) throw Service.result({ status: false, id: id, message: '이미 삭제된 시즌입니다.' });
        else if (season.cursor === true) throw Service.result({ status: false, id: id, message: '진행중인 시즌은 먼저 종료시켜야 합니다.' });

        let promises = [
            season.destroy({ transaction }),
            CountCacheService.decrease(CountCacheKey.SEASON, { transaction }),
            AdminLogService.write(AdminLogAction.SEASON_MANAGE, `시즌[${season.id}:${season.name}] 삭제`, { transaction, updatedBy: options?.updatedBy })
        ]

        await Promise.all(promises);

        return Service.result({ status: true, id: id, message: `시즌 삭제 ${season.name} 이(가) 삭제되었습니다.` });
    });
  }

  static async update(id: number, updated: SeasonType, options?: ServiceOptions) {
    return await Service.handler(options, async (transaction) => {

        const original = await Season.findByPk(id, { transaction } );
        if(!original) throw Service.result({ status: false, id: id, message: '이미 삭제된 시즌입니다.' });

        if (updated.name){
            original.name = updated.name! || original.name;
        }

        if (updated.startDate || updated.endDate){
            const checkStartDate = updated.startDate || original.startDate
            const checkEndDate = updated.endDate || original.endDate;
            if (original.cursor && !isWithinInterval(new Date(), { start: checkStartDate, end: checkEndDate })){
                throw Service.result({ status: false, id: id, message: '진행중인 시즌의 날짜는 오늘을 포함해야 합니다.' });
            }

            original.startDate = checkStartDate
            original.endDate = checkEndDate

            await this.checkOverlapAndValidSeason(original, { transaction, excludeId: id });
        }
        
        original.updatedBy = options?.updatedBy || 'SYSTEM';

        let promises = [
            original.save({ transaction }),
            AdminLogService.write(AdminLogAction.SEASON_MANAGE, `시즌[${original.id}:${original.name}] 수정`, { transaction, updatedBy: original.updatedBy })
        ]

        await Promise.all(promises);
        return Service.result({ status: true, id: id, message: `시즌이 수정되었습니다.` });
    });
  }

  static async start(id: number, options?: ServiceOptions) {
    return await Service.handler(options, async (transaction) => {

        const season = await Season.findByPk(id, {
            attributes: ['id', 'name', 'cursor'],
            transaction
        })

        if (!season) throw Service.result({ status: false, id: id, message: '이미 삭제된 시즌입니다.' });
        else if (season.cursor) throw Service.result({ status: false, id: id, message: '이미 진행중인 시즌입니다.' });

        //기존 진행중인 시즌 있는지 확인
        const currentSeason = await Season.findOne({
            attributes: ['id', 'name'],
            where: { cursor: true }
        })

        if (currentSeason) throw Service.result({ status: false, id: id, message: `진행중인 시즌 ${currentSeason.name} 을(를) 먼저 종료해야합니다.` });

        season.cursor = true;
        season.updatedBy = options?.updatedBy || 'SYSTEM';

        let promises = [
            season.save({ transaction }),
            AdminLogService.write(AdminLogAction.SEASON_MANAGE, `시즌[${season.id}:${season.name}] 시작`, { transaction, updatedBy: season.updatedBy })
        ]

        await Promise.all(promises);
        return Service.result({ status: true, id: id, message: `시즌 ${season.name} 이(가) 시작되었습니다.` });
    });
  }

    static async end(id: number, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const season = await Season.findByPk(id, {
                attributes: ['id', 'name', 'cursor'],
                transaction
            });

            if (!season) throw Service.result({ status: false, id: id, message: '이미 삭제된 시즌입니다.' });
            else if (!season.cursor) throw Service.result({ status: false, id: id, message: '진행중인 시즌이 아닙니다.' });

            season.cursor = null; // 커서를 false로 설정하여 시즌을 종료함
            season.updatedBy = options?.updatedBy || 'SYSTEM'; // 업데이트한 사용자 설정

            let promises = [
                season.save({ transaction }), // 변경사항 저장
                AdminLogService.write(AdminLogAction.SEASON_MANAGE, `시즌[${season.id}:${season.name}] 종료`, { transaction, updatedBy: season.updatedBy }) // 로그 작성
            ];

            await Promise.all(promises);
            return Service.result({ status: true, id: id, message: `시즌 ${season.name} 이(가) 종료되었습니다.` });
        });
    }



  private static async checkOverlapAndValidSeason(season: SeasonType, options: { transaction?: Transaction | null, excludeId?: number} = {}) {

    if (new Date(season.startDate!) >= new Date(season.endDate!)) throw Service.result({ status: false, id: season.id!, message: `종료일시가 시작일시와 같거나 빠를 수 없습니다.` });

    const overlapSeason = await Season.findOne({
        attributes: ['id', 'name', 'startDate', 'endDate'],
        where: {
            [Op.or]: [
                {
                    startDate: { 
                        [Op.lte]: season.endDate,
                    },
                    endDate: {
                        [Op.gte]: season.startDate
                    }
                }
            ],
            ...(options.excludeId && {
                id: {
                    [Op.ne]: options.excludeId
                }
            })
        },
        transaction: options.transaction
    });

    if (overlapSeason) throw Service.result({ status: false, id: overlapSeason.id,
        message: `기존 시즌 ${overlapSeason.name} 와(과) 날짜가 겹칩니다. (${formatDatetime(overlapSeason.startDate, {includeSeconds: false,})} ~ ${formatDatetime(overlapSeason.endDate, {includeSeconds: false,})})`
    });

    return null;
  }


}
