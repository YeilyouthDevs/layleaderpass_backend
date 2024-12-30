import { AdminLogAction } from "@/enums/adminLogAction";
import { Service, ServiceOptions } from "@/lib/service";
import { TalentAssignment } from "@/models/talentAssignment";
import { TalentSum } from "@/models/talentSum";
import { Training } from "@/models/training";
import { TrainingType as TrainingTypeModel } from "@/models/trainingType";
import { User } from "@/models/user";
import { IndexHints, Transaction } from "sequelize";
import { AdminLogService } from "./adminLogService";
import { sequelize } from "@/configs/sequelizeConfig";
import { isTest } from "@/configs/envConfig";
import cron from 'node-cron';


export class TalentService {

    static async getSelfTotalTalent(userEmail: string) {
        let totalSum = 0;

        //TalentSum 에서 사용자 달란트값 모두 더하기
        const sums = await TalentSum.findAll({
            where: { userEmail },
            attributes: ['sum'],
            indexHints: [{ type: IndexHints.FORCE, values: ['idx_userEmail'] }],
        });

        for (const sum of sums) totalSum += (sum as any).sum;
        return totalSum;
    }

    static async grant(userEmail: string, trainingId: number, amount: number, options?: ServiceOptions){
        return await Service.handler(options, async (transaction) => {

            //자료형 파싱 (amount가 string이면 치명적임)
            trainingId = parseInt(trainingId as any);
            amount = parseInt(amount as any);

            // 사용자와 훈련 정보를 동시에 조회
            const [user, training] = await Promise.all([
                User.findByPk(userEmail, {
                    lock: Transaction.LOCK.UPDATE,
                    attributes: ['email', 'name', 'talent'],
                    transaction
                }),
                Training.findByPk(trainingId, {
                    attributes: ['id', 'title'],
                    include: [{
                        model: TrainingTypeModel,
                        as: 'trainingType',
                        attributes: ['id', 'maxTalent']
                    }],
                    transaction
                }) as any
            ]);
    
            // 사용자 또는 훈련이 존재하지 않는 경우 예외 처리
            if (!user) throw Service.result({ status: false, id: userEmail, message: '지급 대상 사용자가 삭제되어 지급할 수 없습니다.' });
            if (!training) throw Service.result({ status: false, id: userEmail, message: '연관된 훈련이 삭제되어 지급할 수 없습니다.' });
            if (!training.trainingType) throw Service.result({ status: false, id: userEmail, message: '연관된 훈련타입이 삭제되어 지급할 수 없습니다.' });
    
            const trainingType = training.trainingType;
    
            // TalentSum 조회
            const talentSum = await TalentSum.findOne({
                lock: Transaction.LOCK.UPDATE,
                where: { trainingId: trainingId, userEmail: userEmail },
                attributes: ['id', 'sum'],
                transaction
            });
    
            // 지급 가능량 초과 검사
            if (trainingType.maxTalent && (talentSum?.sum || 0) + amount > trainingType.maxTalent) {
                throw Service.result({ status: false, id: userEmail, message: '지급 시 최대 지급가능량 초과함' });
            }
    
            const updatedBy = options?.updatedBy || 'SYSTEM';

            let sumPromise = [
                user.increment('talent', { by: amount, transaction }),
                talentSum ? talentSum.increment('sum', { by: amount, transaction }) :
                TalentSum.create({ trainingId, userEmail, sum: amount }, { transaction })
            ]

            const talentAssignment = await TalentAssignment.create({
                    trainingId, 
                    userEmail, 
                    amount, 
                    updatedBy, 
                    createdBy: updatedBy
                }, {
                    transaction
            });
    
    
            let logPromise = AdminLogService.write(AdminLogAction.TALENT_ASSIGNMENT, `달란트[${talentAssignment.id}:+${amount}] 지급, 사용자[${user.email}:${user.name}] 훈련[${training.id}:${training.title}]`, { updatedBy, transaction });
    
            // 모든 업데이트 작업 대기
            await Promise.all([
                sumPromise, 
                logPromise,
            ]);
    
            return Service.result({ status: true, id: userEmail, message: `${user.name} 에게 ${amount} 달란트 지급 완료`, payload: { talentAssignmentId: talentAssignment.id } });
        });
    }

    static async revoke(talentAssignmentId: number, options: ServiceOptions = {}){
        return await Service.handler(options, async (transaction) => {

            // 달란트 지급기록을 가져옴
            const talentAssignment = await TalentAssignment.findByPk(talentAssignmentId, {
                lock: Transaction.LOCK.UPDATE,
                attributes: ['id', 'trainingId', 'userEmail', 'amount'],
                transaction
            }) as any;
    
            if (!talentAssignment) throw Service.result({ status: false, id: talentAssignmentId, message: '이미 회수되었습니다.' });

            // trainingId로부터 trainingTypeId를 가져옴
            const training = await Training.findByPk(talentAssignment.trainingId, {
                attributes: ['id', 'title'],
                include: [{
                    model: TrainingTypeModel,
                    foreignKey: 'trainingTypeId',
                    as: 'trainingType',
                    attributes: ['id']
                }],
                transaction
            }) as any;

            const user = await User.findByPk(talentAssignment.userEmail, {
                attributes: ['email', 'name'],
                transaction
            });

            if (!user) throw Service.result({ status: false, id: talentAssignmentId, message: '지급 대상 사용자가 삭제되어 지급할 수 없습니다.' });
            if (!training) throw Service.result({ status: false, id: talentAssignmentId, message: '연관된 훈련이 삭제되어 회수할 수 없습니다.' });
            if (!training.trainingType) throw Service.result({ status: false, id: talentAssignmentId, message: '연관된 훈련타입이 삭제되어 회수할 수 없습니다.' });

            const talentSum = await TalentSum.findOne({
                lock: Transaction.LOCK.UPDATE,
                attributes: ['id', 'sum'],
                where: {
                    trainingId: training.id,
                    userEmail: talentAssignment.userEmail
                },
                transaction
            });

            if (!talentSum) throw new Error('talentSum없음, 일관성 오류');

            const toBeTalentSum = (talentSum?.sum || 0) - talentAssignment.amount;
            talentSum.sum = toBeTalentSum;

            // 달란트 지급기록을 삭제함
            const updatedBy = options.updatedBy || 'SYSTEM';
            talentAssignment.updatedBy = updatedBy;

            const amount = talentAssignment.amount;

            await Promise.all([
                user.decrement('talent', { by: amount, transaction }),
                talentAssignment.destroy({ transaction }),
                (toBeTalentSum > 0) ? talentSum.save({ transaction }) : talentSum.destroy({ transaction }),
                AdminLogService.write(AdminLogAction.TALENT_ASSIGNMENT, `달란트[${talentAssignmentId}:+${amount}] 회수, 사용자[${user.email}:${user.name}] 훈련[${training.id}:${training.title}]`, { updatedBy, transaction })
            ]);

            return Service.result({status: true, id: talentAssignmentId, message: `${user.name} 으로부터 ${amount} 달란트 회수 완료`});
        });
    }

    static async syncTalent() {
        const transaction = await sequelize.transaction();

        try {
            const userBatchSize = 10;
            let userOffset = 0;
        
            // 사용자 배치 단위로 talentSum과 User.talent 동기화
            while (true) {
                // 사용자 데이터를 배치로 가져옴
                const users = await User.findAll({
                    limit: userBatchSize,
                    offset: userOffset,
                    attributes: ['email'],  // 필요한 필드만 가져옴
                    lock: Transaction.LOCK.UPDATE,
                    transaction
                });
                if (users.length === 0) break;  // 더 이상 사용자가 없으면 종료
        
                const userEmails = users.map(user => user.email);
        
                // 각 사용자에 대한 talentSum의 합계를 계산
                const talentSums = await TalentSum.findAll({
                    where: {
                        userEmail: userEmails
                    },
                    attributes: ['userEmail', [sequelize.fn('SUM', sequelize.col('sum')), 'totalTalent']],  // 각 사용자의 sum 합계 계산
                    group: ['userEmail'],
                    lock: Transaction.LOCK.UPDATE,
                    transaction,
                    raw: true
                });
        
                // 사용자들의 talentSum 총합을 기반으로 비동기 병렬로 User의 talent 업데이트
                await Promise.all(talentSums.map(async (talentSum: any) => {
                    await User.update(
                        { talent: talentSum.totalTalent },  // talent 필드에 합산된 값 업데이트
                        { 
                            where: { email: talentSum.userEmail },
                            transaction
                        }
                    );
                }));
        
                // 다음 사용자 배치로 넘어가기
                userOffset += userBatchSize;
            }

            await transaction.commit();
        } catch(error) {
            await transaction.rollback();
            throw error;
        }
    }
}

// 달란트 동기화 크론
if (!isTest){
    cron.schedule(
      "0 0 * * *", // 매일 자정에 실행
      async () => {
        try {
            await TalentAssignment.sync();    
        } catch (error) {
            console.error('달란트 동기화 예약작업 실패', error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Seoul",
      }
    );
  }