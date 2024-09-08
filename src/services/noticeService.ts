import { AdminLogAction } from "@/enums/adminLogAction";
import { CountCacheKey } from "@/enums/countCacheKey";
import { NoticeLevel } from "@/enums/noticeLevel";
import { FileProcessor } from "@/lib/FileManager/FileProcessor";
import { Service, ServiceOptions } from "@/lib/service";
import { ensureNotEmpty } from "@/lib/validation";
import { Notice } from "@/models/notice";
import { FastifyRequest } from "fastify";
import { AdminLogService } from "./adminLogService";
import { CountCacheService } from "./countCacheService";
import { setIf, switchAs } from "@/lib/queryTools";
import { Pagination } from "@/lib/pagination";
import { Order } from "sequelize";
import { Op } from "sequelize";
import { ControlledError } from "@/controlledError";

export class NoticeService {

    static async getList(req: FastifyRequest) {
        const query = req.query as any;

        const { sort, searchBy, searchString } = query;
        const { level } = req.params as any;
        ensureNotEmpty([ level ])

        const pageData = await Pagination.fetch(Notice, query, {
            countCacheKey: searchBy ? undefined : CountCacheKey['NOTICE_' + level.toUpperCase()],
            order: switchAs<Order>(sort, {
                default: [['level', 'DESC'], ['createdAt', 'DESC']]
            }),
            attributes: [ 'id', 'title', 'level', 'createdAt'],
            where: {
                ...setIf(searchBy === 'title', {
                    title: { [Op.like] : `%${searchString}%` }
                }),
                ...setIf(level === 'significant', {
                    level: { [Op.ne] : NoticeLevel.DEFAULT }
                }),
                ...setIf(level === 'default', {
                    level: { [Op.eq] : NoticeLevel.DEFAULT }
                })
            }
        })

        return pageData
    }

    static async getSpec(req: FastifyRequest) {
        const { id } = req.query as any;
        ensureNotEmpty([ id ]);

        const notice = await Notice.findByPk(id);
        if (!notice) throw new ControlledError({ message: '이미 삭제된 공지입니다.' });

        return notice;
    }

    static async create(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);

            try {
                const fileSaveResult = await fileProcessor.save(req);

                const fileSetId = fileSaveResult.fileSetId;
                const { title, level, content } = fileSaveResult.data;
                const { email: createdBy } = req.headers as any;
                ensureNotEmpty([title, level, content, createdBy]);

                const notice = { title, level, content, fileSetId, createdBy, updatedBy: createdBy };
                const created = await Notice.create(notice, { transaction });
                
                let promises = [
                    CountCacheService.increase(CountCacheKey.NOTICE_COMBINED, { transaction }),
                    AdminLogService.write(AdminLogAction.NOTICE, `공지[${created.id}:${created.title}] 추가`, { updatedBy: notice.updatedBy, transaction })
                ]

                if (notice.level === NoticeLevel.DEFAULT) {
                    promises.push(CountCacheService.increase(CountCacheKey.NOTICE_DEFAULT, { transaction }))
                } else {
                    promises.push(CountCacheService.increase(CountCacheKey.NOTICE_SIGNIFICANT, { transaction }))
                }
                
                await Promise.all(promises);
                await fileProcessor.finish();

                return Service.result({ status: true, id: created.id!, message: '등록 되었습니다.' });
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

    static async edit(req: FastifyRequest, options?: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!, { maxFileCount: 6 });

            try {
                const fileSaveResult = await fileProcessor.save(req);

                const { fileSetId, data } = fileSaveResult
                const { noticeId, title, level, content } = data;
                const { email: adminEmail } = req.headers as any;
                ensureNotEmpty([noticeId, title, level, content, adminEmail]);

                const editData = {
                    title, fileSetId, level, content, updatedBy: adminEmail
                }

                const notice = await Notice.findByPk(noticeId, {
                    attributes: [ 'id', 'title', 'level' ],
                    transaction,
                });

                if (!notice) throw Service.result({ status: false, id: noticeId, message: '이미 삭제된 공지입니다.' });

                let promises = []

                if (notice.level === NoticeLevel.DEFAULT && editData.level !== NoticeLevel.DEFAULT) { //일반에서 중요/필수 공지로 변경될때
                    promises.push(CountCacheService.decrease(CountCacheKey.NOTICE_DEFAULT, { transaction }))
                    promises.push(CountCacheService.increase(CountCacheKey.NOTICE_SIGNIFICANT, { transaction }))
                } else if(notice.level !== NoticeLevel.DEFAULT && editData.level === NoticeLevel.DEFAULT) { //중요/필수 공지에서 일반으로 변경될때
                    promises.push(CountCacheService.decrease(CountCacheKey.NOTICE_SIGNIFICANT, { transaction }))
                    promises.push(CountCacheService.increase(CountCacheKey.NOTICE_DEFAULT, { transaction }))
                }

                promises = [ ...promises,
                    AdminLogService.write(AdminLogAction.NOTICE, `공지[${noticeId}:${notice.title}] 수정`, { updatedBy: editData.updatedBy, transaction }),
                    notice.update(editData, { transaction })
                ]

                await Promise.all(promises);
                await fileProcessor.finish();

                return Service.result({ status: true, id: noticeId, message: '수정되었습니다.' });
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

    static async delete(noticeId: number, options: ServiceOptions) {
        return await Service.handler(options, async (transaction) => {
            const fileProcessor = new FileProcessor(transaction!);

            try {
                const notice = await Notice.findByPk(noticeId, {
                    attributes: ['id', 'fileSetId', 'title', 'level'],
                    transaction,
                })
    
                if (!notice) throw Service.result({ status: false, id: noticeId, message: '이미 삭제된 공지입니다.' });
    
                const fileSetId = notice.fileSetId!;
    
                let promises = [];
    
                if (notice.level === NoticeLevel.DEFAULT) {
                    promises.push(CountCacheService.decrease(CountCacheKey.NOTICE_DEFAULT, { transaction }))
                } else {
                    promises.push(CountCacheService.decrease(CountCacheKey.NOTICE_SIGNIFICANT, { transaction }))
                }
    
                promises = [...promises,
                    CountCacheService.decrease(CountCacheKey.NOTICE_COMBINED, { transaction }),
                    AdminLogService.write(AdminLogAction.NOTICE, `공지[${noticeId}:${notice.title}] 삭제`, { updatedBy: options.updatedBy, transaction }),
                    notice.destroy({ transaction }),
                    fileProcessor.destroy(fileSetId)
                ]
    
                await Promise.all(promises);
                await fileProcessor.finish();

                return Service.result({ status: true, id: noticeId, message: '삭제되었습니다.' });
            } catch (error) {
                await fileProcessor.reset();
                throw error;
            }
        })
    }

}