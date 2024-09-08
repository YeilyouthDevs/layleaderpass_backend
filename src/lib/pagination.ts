import { CountCacheService } from "@/services/countCacheService"; // CountCacheService import 추가
import { FastifyRequest } from "fastify";
import {
    FindOptions,
    IncludeOptions,
    IndexHint,
    Model,
    ModelStatic,
    Op,
} from "sequelize";

export interface PaginationRequest {
    limit: number;
    page: number;
    sort?: string;
    searchBy?: string;
    searchString?: string;
    startAt?: Date;
}

export interface PaginationResponse<T> {
    data: T[];
    meta: {
        totalCount: number;
        totalPages: number;
        currentPage: number;
        startAt?: Date;
    };
}

export interface PaginationOptions extends FindOptions {
    countCacheKey?: string;
    countIndexHint?: IndexHint[];
}

export class Pagination {
    static async fetch<T extends Model>(
        model: ModelStatic<T>,
        request: PaginationRequest,
        options: PaginationOptions = {}
    ): Promise<PaginationResponse<T>> {
        const limit = +request.limit;
        const page = +request.page;
        const offset = (page - 1) * limit;
        const startAt = request.startAt
            ? new Date(request.startAt)
            : new Date();

        const combinedWhere = this.combineWhereConditions(
            options.where,
            startAt
        );

        const findOptions: FindOptions = {
            ...options,
            where: combinedWhere,
            limit,
            offset,
            order: options.order,
        };

        // 데이터와 총 개수를 병렬로 가져옴
        const [data, total] = await Promise.all([
            model.findAll(findOptions),
            this.getTotalCount(model, { ...findOptions }), // include 조건 포함
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            data,
            meta: {
                totalCount: total,
                totalPages,
                currentPage: page,
                startAt,
            },
        };
    }

    private static combineWhereConditions<T extends Model>(
        where: any,
        startAt: Date
    ): any {
        const internalCreatedAtCondition = { [Op.lte]: startAt };

        return {
            ...where,
            createdAt: where?.createdAt
                ? {
                      [Op.and]: [where.createdAt, internalCreatedAtCondition],
                  }
                : internalCreatedAtCondition,
        };
    }

    private static async getTotalCount<T extends Model>(
        model: ModelStatic<T>,
        options: PaginationOptions
    ): Promise<number> {
        // countCacheKey가 있는 경우 캐시 사용
        if (options.countCacheKey) {
            const cachedTotal = await CountCacheService.get(
                options.countCacheKey
            );
            if (cachedTotal !== null && cachedTotal !== undefined) {
                return cachedTotal;
            }
        }
    
        // attributes와 include 옵션을 설정
        const countOptions: FindOptions = {
            ...options,
            attributes: [model.primaryKeyAttribute], // 기본 모델의 PK만 가져오도록 설정
            limit: undefined, // 전체 결과를 가져오기 위해 limit 제거
            offset: undefined, // 전체 결과를 가져오기 위해 offset 제거
            include: this.applyPrimaryKeyToIncludes(options.include as any), // include된 모델에도 PK만 가져오도록 설정
        };
    
        const result = await model.findAll(countOptions);
        return result.length;
    }
    
    private static applyPrimaryKeyToIncludes(
        includes?: IncludeOptions[]
    ): IncludeOptions[] | undefined {
        if (!includes || includes.length === 0) return undefined;
    
        return includes.map((include) => {
            if (!include || !include.model) {
                return include;
            }
    
            const model = include.model as ModelStatic<Model>;
    
            return {
                ...include,
                attributes: [model.primaryKeyAttribute], // include된 모델에도 PK만 가져오도록 설정
                include: Array.isArray(include.include) && include.include.length > 0
                    ? this.applyPrimaryKeyToIncludes(include.include as any)
                    : [], // 재귀적으로 적용
            };
        });
    }

    static extractRequest(req: FastifyRequest): PaginationRequest {
        const { limit, page, sort, searchBy, searchString, startAt } =
            req.query as any;

        return {
            limit,
            page,
            sort,
            searchBy,
            searchString,
            startAt,
        };
    }
}
