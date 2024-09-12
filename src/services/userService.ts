import { ControlledError } from "@/controlledError";
import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { UserRole } from "@/enums/userRole";
import { formatDatetime, getAfterMidnight } from "@/lib/date";
import { renderTemplate } from "@/lib/ejs";
import { Pagination, PaginationRequest } from "@/lib/pagination";
import { switchAs } from "@/lib/queryTools";
import {
    Service,
    ServiceOptions,
} from "@/lib/service";
import { Season } from "@/models/season";
import type { UserType } from "@/models/user";
import { User } from "@/models/user";
import bcrypt from "bcrypt";
import { Order, Transaction } from "sequelize";
import { v4 } from "uuid";
import { sendMail } from "../lib/mail";
import { AdminLogService } from "./adminLogService";
import { CountCacheService } from "./countCacheService";
import { TalentService } from "./talentService";
import { sequelize } from "@/configs/sequelizeConfig";
import { FastifyRequest } from "fastify";
import { TalentSum } from "@/models/talentSum";
import { TalentAssignment } from "@/models/talentAssignment";
import { UserSubmission } from "@/models/userSubmission";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";
export class UserService {
    static async getList(req: FastifyRequest) {
        const { sort } = req.query as any;

        const pageData = await Pagination.fetch(
            User,
            req.query as PaginationRequest,
            {
                order: switchAs<Order>(sort, {
                    default: [["name", "ASC"]],
                }),
                attributes: ["email", "name", "birthday", "talent"],
            }
        );

        return pageData;
    }

    static async create(user: UserType, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const existingUser = await User.findByPk(user.email!, {
                paranoid: false,
                transaction,
            });

            if (existingUser && !existingUser.deletedAt && !existingUser.isDeleted) {
                return Service.result({ status: false, message: '이미 가입된 이메일입니다. 만약 본인이 가입하지 않았다면 운영팀으로 문의해주세요.' });
            }

            const promises = [];

            if (!existingUser) {
                promises.push(...[
                    User.create(user, { transaction }),
                    CountCacheService.increase(CountCacheKey.UNAPPROVED_USER, { transaction }),
                    CountCacheService.increase(CountCacheKey.ALL_USER, { transaction })
                ]);
            } else if (existingUser.isDeleted) {
                user.isDeleted = false;
                user.deleteConfirmAt = null;
                await existingUser.update(user, { transaction });

                promises.push(existingUser.restore({ transaction }) as any);

                if (existingUser.role !== UserRole.GUEST) {
                    promises.push(...[
                        CountCacheService.increase(CountCacheKey.APPROVED_USER, { transaction }),
                        CountCacheService.decrease(CountCacheKey.UNAPPROVED_USER, { transaction })
                    ])
                }
            }

            await Promise.all(promises);
            return Service.result({ status: true, message: "회원가입이 완료되었습니다."});
        });
    }

    static async edit(email: string, updated: UserType, isDeleted: boolean, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const user = await User.findByPk(email, {
                lock: Transaction.LOCK.UPDATE,
                transaction,
            });

            if (!user){
                throw new ControlledError({
                    message: "계정이 존재하지 않아 수정할 수 없습니다.",
                    alertOptions: { type: "fail" },
                });
            }

            if (isDeleted) user.isDeleted = false;
            if (updated.password) user.password = await bcrypt.hash(updated.password, await bcrypt.genSalt());
            user.name = updated.name;
            user.birthday = updated.birthday;
            user.phone = updated.phone || null;
            
            await user.save({ transaction });
            return Service.result({ status: true, message: "수정 완료" });
        });
    }

    static async confirmRegister(email: string, confirm: boolean, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
                const user = await User.findByPk(email, {
                    lock: Transaction.LOCK.UPDATE,
                    paranoid: false,
                    transaction,
                });

                if (!user) return Service.result({ status: false, id: email, message: "존재하지 않는 사용자입니다." });
                else if (user.deletedAt) return Service.result({ status: false, id: email, message: "이미 거절된 사용자입니다." });
                else if (user.role !== UserRole.GUEST) return Service.result({ status: false, id: email, message: "이미 승인된 사용자입니다." });

                user.updatedBy = options?.updatedBy || 'SYSTEM';
                let label;
                let mailContent = `안녕하세요, 중직자PASS입니다. ${user.name} 님의 회원가입이 `;

                if (confirm) {
                    label = "승인";
                    mailContent += `${label} 되었습니다.<br><br>감사합니다.`;
                    user.role = UserRole.USER;

                    // acceptNo 설정
                    const maxAcceptNoUser = await User.findOne({
                        attributes: [
                            [ sequelize.fn("MAX", sequelize.col("acceptNo")), "maxAcceptNo"] ,
                        ],
                        transaction,
                    });

                    const maxAcceptNo = maxAcceptNoUser ? maxAcceptNoUser.get("maxAcceptNo") : 0;
                    user.acceptNo = (maxAcceptNo as number) + 1;

                    await Promise.all([
                        user.save({ transaction }),
                        CountCacheService.decrease(CountCacheKey.UNAPPROVED_USER, { transaction }),
                        CountCacheService.increase(CountCacheKey.APPROVED_USER, { transaction }),
                        AdminLogService.write(AdminLogAction.REGISTER_ACCEPTION, `사용자[${user.email}:${user.name}] 가입 승인`, { transaction, updatedBy: user.updatedBy })
                    ]);
                } else {
                    //2주 후 삭제되도록 deleteConfirmAt 설정
                    const deleteConfirmAt = getAfterMidnight(new Date(), 7 * 2); //2주후
                    user.deleteConfirmAt = deleteConfirmAt;
                    user.updatedBy = options?.updatedBy || 'SYSTEM';

                    label = "거절";
                    mailContent += `${label} 되었습니다.<br>${
                        user.name
                    } 님의 계정은 ${formatDatetime(deleteConfirmAt, {
                        includeTime: false,
                        includeWeekDay: true,
                    })} 0시 0분에 완전히 삭제됩니다.<br><br>오류라고 생각되시는 경우 중직자PASS 운영팀으로 문의해주시길 바랍니다.<br><br>감사합니다.`;

                    await AdminLogService.write(AdminLogAction.REGISTER_ACCEPTION, `사용자[${user.email}:${user.name}] 가입 거절`, { transaction, updatedBy: user.updatedBy });
                    await user.destroy({ transaction });
                }

                //안내메일 전송
                const title = `가입이 ${label} 되었습니다`;
                const mailBody = await renderTemplate("linkedMail", { title, content: mailContent });
                await sendMail(email, title, mailBody);

                return Service.result({ status: true, id: email, message: `${label} 완료` });
            }
        );
    }

    static async getSelfInfo(email: string, forEdit = false, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            let attributes;
            if (forEdit) {
                attributes = ["name", "birthday", "phone"];
            } else {
                attributes = ["name", "role", 'talent', "deletedAt", "deleteConfirmAt"];
            }

            const user = await User.findByPk(email, {
                attributes,
                paranoid: false,
                transaction,
            })

            if (!user){
                return Service.result({ status: false, message: "존재하지 않는 사용자입니다." });
            }

            return Service.result({ status: true, message: "완료", payload: { user } });
        })
    }

    static async getContact(email: string) {
        const user = await User.findByPk(email, {
            attributes: ["email", "name", "phone", "deletedAt"],
            paranoid: false,
        });

        if (!user || user.deletedAt){
            return { email: "(사용자 정보 없음)" }
        }

        return user;
    }

    /**
     * 이미 사용중인 이메일인지 확인함
     *
     * @param email 사용자 이메일
     * @returns payload.exists
     */
    static async isExists(email: string) {
        const user = await User.findByPk(email);
        return user ? true : false;
    }

    static async changeRole(email: string, targetRole: UserRole, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const user = await User.findByPk(email, {
                attributes: ["email", "name", "role", "acceptNo"],
                paranoid: false,
                lock: Transaction.LOCK.UPDATE,
                transaction,
            });

            if (!user) return Service.result({ status: false, id: email, message: '삭제 확정된 사용자입니다.' });
            else if (user.role === UserRole.GUEST && user.acceptNo === null) return Service.result({ status: false, id: email, message: '가입 승인 전에는 역할변경이 불가능합니다.' });
            /* user.acceptNo === null 은 탈퇴/삭제 처리된 사용자가 재 가입한 경우 회원가입 승인거절에 표시되지 않게하고, changeRole을 통해 활동여부를 통제하기 위함임 */

            const updatedBy = options?.updatedBy || 'SYSTEM';
            const originalRole = user.role;
            user.role = targetRole;
            user.updatedBy = updatedBy;

            let promises: any[] = [
                user.save({ transaction }),
                AdminLogService.write(AdminLogAction.ACCOUNT_MANAGE, `사용자[${user.email}:${user.name}] 역할 변경 ${originalRole} → ${targetRole}`, { updatedBy, transaction })
            ]

            if (originalRole === UserRole.GUEST && targetRole !== UserRole.GUEST) {
                promises.push(...[
                    CountCacheService.increase(CountCacheKey.APPROVED_USER, { transaction }),
                    CountCacheService.decrease(CountCacheKey.UNAPPROVED_USER, { transaction }),
                ])
            } else if (originalRole !== UserRole.GUEST && targetRole === UserRole.GUEST) {
                promises.push(...[
                    CountCacheService.increase(CountCacheKey.UNAPPROVED_USER, { transaction }),
                    CountCacheService.decrease(CountCacheKey.APPROVED_USER, { transaction }),
                ])
            }

            await Promise.all(promises);
            return Service.result({ status: true, id: email, message: `${user.email}(${user.name}) 의 역할이 ${targetRole} (으)로 변경되었습니다.` });
        });
    }

    static async delete(email: string, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
                const user = await User.findByPk(email, {
                    attributes: [
                        "email",
                        "name",
                        "deletedAt",
                        "deleteConfirmAt",
                    ],
                    paranoid: false,
                    lock: Transaction.LOCK.UPDATE,
                    transaction,
                });

                if (!user) {
                    return Service.result({ status: false, id: email, message: '이미 삭제 확정되었습니다.' });
                } else if (user.deletedAt) {
                    return Service.result({ status: false, id: email, message: '이미 삭제되었습니다.' });
                }

                const updatedBy = options?.updatedBy || 'SYSTEM';
                user.updatedBy = updatedBy;

                //현재 활성시즌 마지막 날짜로 삭제예정일 설정
                const currentSeason = await Season.findOne({
                    attributes: ["endDate"],
                    where: { cursor: true },
                    transaction,
                });

                if (currentSeason) {
                    user.deleteConfirmAt = currentSeason.endDate;
                } else {
                    user.deleteConfirmAt = getAfterMidnight(new Date(), 365 * 2); //활성시즌이 없으면 2년뒤 삭제
                }

                await AdminLogService.write(AdminLogAction.ACCOUNT_MANAGE, `사용자[${user.email}:${user.name}] 삭제/탈퇴 `,{ updatedBy, transaction });

                // 개인정보 삭제
                user.role = UserRole.GUEST;
                user.phone = null;
                user.birthday = null;
                user.isDeleted = true;

                await Promise.all([
                    user.destroy({ transaction }),
                    CountCacheService.decrease(CountCacheKey.APPROVED_USER, { transaction }),
                    CountCacheService.increase(CountCacheKey.UNAPPROVED_USER, { transaction }),
                ]);

                //사용자에게 복원 안내 메일 발송, 임시 비밀번호 포함해서
                const title = "계정이 탈퇴처리 되었습니다";
                const mailBody = await renderTemplate("linkedMail", {
                    title,
                    content: `안녕하세요, 중직자PASS입니다. ${
                        user.name
                    } 님의 계정이 탈퇴처리 되었습니다. 사용자 개인정보는 삭제되었으며, 훈련정보는 오는 ${formatDatetime(user.deleteConfirmAt,
                        { includeSeconds: false }
                    )} (KST) 에 완전히 삭제될 예정입니다. 탈퇴처리에 대한 사유나 기타 문의사항은 중직자PASS 운영팀으로 문의해주시길 바랍니다. 감사합니다.`,
                });

                await sendMail(email, title, mailBody);
                return Service.result({ status: true, id: email, message: '삭제 완료' });
            }
        );
    }

    static async deleteConfirm(email: string, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {

            const userSubmissionProcessors: FileProcessor[] = [];

            try {
                const user = await User.findByPk(email, {
                    attributes: ["email", "name", "deletedAt"],
                    paranoid: false,
                    lock: Transaction.LOCK.UPDATE,
                    transaction,
                });
    
                if (!user) {
                    return Service.result({ status: false, id: email, message: '이미 삭제 확정되었습니다.' });
                } else if (!user.deletedAt) {
                    return Service.result({ status: false, id: email, message: '먼저 삭제한 후 확정해야합니다.' });
                }
    
                //모든 UserSubmission 불러오기
                const userSubmissions = await UserSubmission.findAll({
                    attributes: ['id', 'fileSetId'],
                    where: { userEmail: email }
                });
    
                const deleteSubmissionTask = async (userSubmission: UserSubmission) => {
                    const userSubmissionProcessor = new FileProcessor(transaction!);
                    userSubmissionProcessors.push(userSubmissionProcessor);
                    await userSubmission.destroy({ transaction });
                    await userSubmissionProcessor.destroy(userSubmission.fileSetId);
                }
    
                let rmUserSubmissionProm = [];
                let deletePromise = [
                    //TalentSum 삭제
                    TalentSum.destroy({
                        where: { userEmail: email }
                    }),
                    //TalentAssignment 삭제
                    TalentAssignment.destroy({
                        where: { userEmail: email }
                    }),
                    (async () => {
                        for(const userSubmission of userSubmissions) {
                            if (userSubmission.fileSetId) {
                                rmUserSubmissionProm.push(deleteSubmissionTask(userSubmission));
                            }
                        }
    
                        await Promise.all(rmUserSubmissionProm);
                    })()
                ]
    
                await Promise.all(deletePromise);
    
                const updatedBy = options?.updatedBy || 'SYSTEM';
                user.updatedBy = updatedBy;
    
                const promises = [
                    user.destroy({ transaction, force: true }),
                    AdminLogService.write(AdminLogAction.ACCOUNT_MANAGE, `사용자[${user.email}] 계정 삭제 확정`, { updatedBy, transaction }),
                    CountCacheService.decrease(CountCacheKey.ALL_USER, { transaction }),
                    CountCacheService.decrease(CountCacheKey.UNAPPROVED_USER, { transaction })
                ];
    
                await Promise.all(promises);
                
                for (const fileProcessor of userSubmissionProcessors) await fileProcessor.finish();
                return Service.result({ status: true, id: email, message: '삭제 확정 완료' });
            } catch (error) {
                for (const fileProcessor of userSubmissionProcessors) await fileProcessor.reset();
                throw error;
            }
        });
    }

    static async restore(email: string, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
                const user = await User.findByPk(email, {
                    attributes: ["email", "name", "deletedAt"],
                    paranoid: false,
                    lock: Transaction.LOCK.UPDATE,
                    transaction,
                });

                if (!user) {
                    return Service.result({ status: false, id: email, message: '이미 삭제 확정되었습니다.' });
                } else if (!user.deletedAt) {
                    return Service.result({ status: false, id: email, message: '아직 삭제되지 않았습니다.' });
                }

                const updatedBy = options?.updatedBy || 'SYSTEM';
                user.updatedBy = updatedBy;
                user.deleteConfirmAt = null;

                const tempPassword = v4();
                user.password = await bcrypt.hash(tempPassword, await bcrypt.genSalt());

                await user.save({ transaction });

                const promises = [
                    user.restore({ transaction }),
                    AdminLogService.write(AdminLogAction.ACCOUNT_MANAGE, `사용자[${user.email}] 계정 복원`, { updatedBy, transaction }),
                ];

                await Promise.all(promises);

                //사용자에게 복원 안내 메일 발송, 임시 비밀번호 포함해서
                const title = `계정이 복원되었습니다`;
                const mailBody = await renderTemplate("linkedMail", {
                    title,
                    content: `안녕하세요, 중직자PASS입니다. ${user.name} 님의 계정이 복원되었습니다. 다음 임시 비밀번호를 사용해 로그인해주세요. 비밀번호: ${tempPassword}`,
                });

                await sendMail(email, title, mailBody);
                return Service.result({ status: true, id: email, message: '복원 완료' });
            }
        );
    }
}
