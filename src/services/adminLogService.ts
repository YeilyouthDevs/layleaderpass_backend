import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { setIf, switchAs } from "@/lib/queryTools";
import { AdminLog } from "@/models/adminLog";
import { IndexHints, Op, Order } from "sequelize";
import { Transaction } from "sequelize";
import { CountCacheService } from "./countCacheService";
import { Service, ServiceOptions } from "@/lib/service";
import { FastifyRequest } from "fastify";

export interface AdminLogOptions {
    updatedBy?: string;
    transaction?: Transaction | null;
}

export class AdminLogService {
    static async getList(req: FastifyRequest) {
        const { sort, searchBy, searchString } = req.query as any;

        const pageData = await Pagination.fetch(AdminLog, req.query as PaginationRequest, {
            countCacheKey: searchBy ? undefined : CountCacheKey.ADMIN_LOG,
            order: switchAs<Order>(sort, {
                default: [['createdAt', 'DESC']]
            }),
            attributes: ["id", "message", "updatedBy", "createdAt"],
            where: {
                ...setIf(searchString && searchBy === "message", {
                    message: {
                        [Op.like]: `%${searchString}%`,
                    },
                })
            },
            indexHints: [{type: IndexHints.FORCE, values: ['idx_createdAt']}]
        });

        return pageData;
    }

    static async write(action: AdminLogAction, message: string, options: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            await Promise.all([
                AdminLog.create(
                    { action, message, updatedBy: options.updatedBy },
                    { transaction }
                ),
                CountCacheService.increase(CountCacheKey.ADMIN_LOG, { transaction })
            ])

            return Service.result({ status: true, message: 'Done' })
        })
    }
}
