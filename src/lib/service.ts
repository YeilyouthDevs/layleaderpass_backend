import { sequelize } from "@/configs/sequelizeConfig";
import { Transaction, TransactionOptions } from "sequelize";

export interface ServiceResult {
    type: string;
    id: string | number | null;
    status: boolean;
    message: string;
    payload?: any;
}

export interface ServiceOptions {
    updatedBy?: string;
    transaction?: Transaction | null;
    transactionOptions?: TransactionOptions;
    beforeCommit?: CallableFunction;
    afterCommit?: CallableFunction;
    beforeRollback?: CallableFunction;
    afterRollback?: CallableFunction;
}

export class Service {
    static result(args: { status: boolean, id?: any | null, message: string, payload?: Record<any, any> }): ServiceResult {
        return { type: 'ServiceResult', status: args.status, id: args.id, message: args.message, payload: args.payload };
    }

    static filterResult(error: any) {
        if (error.type === 'ServiceResult') return error as ServiceResult;
        throw error;
    }

    static async handler(options: ServiceOptions | undefined, callback: (transaction?: Transaction | null) => Promise<ServiceResult>) {
        const transaction = (options?.transaction) ? options.transaction : await sequelize.transaction(options?.transactionOptions);
    
        try {
            const result: ServiceResult = await callback(transaction);
            if (options?.beforeCommit) await options.beforeCommit(transaction);
            if (!options?.transaction) await transaction.commit();
            if (options?.afterCommit) await options.afterCommit(transaction);
            return result;
        } catch (error) {
            if (options?.beforeRollback) await options.beforeRollback(transaction);
            if (!options?.transaction) await transaction.rollback();
            if (options?.afterRollback) await options.afterRollback(transaction);
            return Service.filterResult(error);
        }
    }
}