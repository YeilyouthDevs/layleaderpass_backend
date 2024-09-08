import { connectDatabase, disconnectDatabase, sequelize } from '../src/configs/sequelizeConfig';
import { TalentService } from '../src/services/talentService';
import { TalentAssignment } from '../src/models/talentAssignment';
import { TalentSum } from '../src/models/talentSum';
import { countUpSettled } from './testTools';

beforeAll(async () => {
    await connectDatabase();
})

afterAll(async () => {
    await disconnectDatabase();
})

describe('달란트', () => {

    test('지급/회수 테스트', async () => {
        const transaction = await sequelize.transaction();

        try {
            const targetEmail = 'user35@example.com';
            const updaterEmail = 'user1@example.com';
            const trainingId = 1;
            const amount = 5;
        
            //달란트 지급
            await TalentService.grant(targetEmail, trainingId, amount, { transaction, updatedBy: updaterEmail })
        
            //지급된 달란트 값 확인
            const talentAssignment = await TalentAssignment.findOne({
                attributes: ['id', 'amount'],
                where: {
                    userEmail: targetEmail,
                    trainingId, amount
                },
                transaction
            })
        
            expect(talentAssignment).toBeTruthy(); //talentAssignment가 존재해야 함
            expect(talentAssignment?.amount).toBe(amount) //talentAssignment가 amount값과 같아야 함

            //한번 더 지급
            await TalentService.grant(targetEmail, trainingId, amount, { transaction, updatedBy: updaterEmail })

            //TalentSum값 확인
            const talentSum = await TalentSum.findOne({
                attributes: ['id', 'sum'],
                where: {
                    userEmail: targetEmail,
                    trainingId
                },
                transaction
            })

            expect(talentSum).toBeTruthy() //talentSum이 존재해야 함
            expect(talentSum?.sum).toBe(amount * 2); //sum이 2번 지급한 amount 만큼이어야 함

            //한번 회수
            const revokedTalentAssignmentId = talentAssignment?.id!;
            await TalentService.revoke(revokedTalentAssignmentId, { transaction, updatedBy: updaterEmail })

            //지급된 달란트 값 확인
            const revokedTalentAssignment = await TalentAssignment.findByPk(revokedTalentAssignmentId, {
                attributes: ['id'],
                transaction
            })

            expect(revokedTalentAssignment).toBeFalsy() //회수한 talentAssignment가 존재하지 않아야 함

            const revokedTalentSumId = talentSum?.id!;
            const revokedTalentSum = await TalentSum.findByPk(revokedTalentSumId, {
                attributes: ['sum'],
                transaction
            })

            expect(revokedTalentSum).toBeTruthy(); //revokedTalentSum이 존재해야 함
            expect(revokedTalentSum?.sum).toBe(amount); //한번 회수한 만큼 달란트 합이 작아져있어야 함
        } finally {
            await transaction.rollback();
        }
    })


    test('2명 관리자가 동시 달란트 회수 시 1명만 성공해야 함', async () => {
        const targetEmail = 'user34@example.com';
        const updaterEmail1 = 'user1@example.com';
        const updaterEmail2 = 'user2@example.com';
        const trainingId = 1;
        const amount = 5;
    
        // 달란트 지급
        const transactionSetup = await sequelize.transaction();
    
        await TalentService.grant(targetEmail, trainingId, amount, { transaction: transactionSetup, updatedBy: updaterEmail1 });

        const talentAssignment = await TalentAssignment.findOne({
            where: { userEmail: targetEmail, trainingId, amount },
            transaction: transactionSetup
        });

        await transactionSetup.commit();

        const talentAssignmentId = talentAssignment?.id!;

        const revoke = async (updaterEmail: string) => {
            const transaction = await sequelize.transaction();

            try {
                const result = await TalentService.revoke(talentAssignmentId, { transaction: transaction, updatedBy: updaterEmail });
                await transaction.commit();    

                return result;
            } catch (error) {
                await transaction.rollback();
            }
        }

        // 두 작업을 병렬로 실행하고 결과 확인
        const results = await Promise.allSettled([revoke(updaterEmail1), revoke(updaterEmail2)]);

        // 성공 및 실패한 작업 수 세기
        const { success, fail } = countUpSettled(results);

        expect(success).toBe(1); // 하나의 작업만 성공해야 함
        expect(fail).toBe(1);    // 하나의 작업은 실패해야 함
    });

})
