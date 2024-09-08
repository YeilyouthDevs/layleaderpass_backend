import { ControlledError } from "@/controlledError";
import { File as FileModel, FileType } from "@/models/file";
import { FileSet, FileSetType } from "@/models/fileSet";
import archiver from "archiver";
import { FastifyReply } from "fastify";
import fs from 'fs';
import { Op } from 'sequelize';
import { File } from '../models/file';
import { FileProcessor } from "@/lib/FileManager/FileProcessor";

interface ArchivingOptions {
    contentType?: string;
    format?: string;
    zipLevel?: number;
}

export class FileSendService {
    static async sendFileSet(fileSetId: number) {
        const fileSet = (await FileSet.findByPk(fileSetId, {
            attributes: [ "updatedAt", "createdAt" ],
            include: [
                {
                    model: FileModel,
                    foreignKey: "fileSetId",
                    as: "files",
                    attributes: ["id", "order", "originId", "originalName", "extension"],
                    where: {
                        [Op.or]: [
                            {
                                isImage: true,
                                originId: {
                                    [Op.not]: null
                                }
                            },
                            {
                                isImage: false,
                                originId: null
                            }
                        ]
                    }
                },
            ],
            order: [['files', 'order', 'ASC']], // 여기에 order 옵션을 추가
        })) as FileSet & {
            files: FileType[] 
        };

        const files = fileSet?.files;

        if (!fileSet || !files) {
            throw new ControlledError({
                message: '첨부파일이 이미 삭제되었거나 존재하지 않습니다.',
                alertOptions: { type: 'fail', duration: 3000 }
            })
        }

        const { updatedAt, createdAt } = fileSet!;

        return { files, updatedAt, createdAt };
    }

    static async sendThumbnails(fileSetId: number, rep: FastifyReply) {
        const fileSet = await FileSet.findByPk(fileSetId, {
            attributes: [ "id", "basePathKey" ],
            include: [
                {
                    model: FileModel,
                    foreignKey: "fileSetId",
                    as: "files",
                    where: {
                        originId: {
                            [Op.not]: null
                        }
                    },
                    order: ['order', 'ASC']
                },
            ],
        }) as FileSet & { files: FileType[] };

        return await this.sendArchive({
            response: rep,
            fileInjectCallback: async (archive) => {
                for (const file of fileSet?.files || []) {
                    
                    const filePath = FileProcessor.generateFilePath(fileSet!.basePathKey!, fileSet!.id!.toString(), file.saveName! + file.extension!);
                    const key = `${file.id}_${file.order}`;

                    archive.file(filePath, { name: key });
                }
            },
        });

    }

    static async sendImage(fileId: number, rep: FastifyReply) {
        const file = await FileModel.findByPk(fileId, {
            include: [
                {
                    model: FileSet,
                    foreignKey: 'fileSetId',
                    as: 'fileSet',
                    attributes: [ "id", "basePathKey" ],
                }
            ],
        }) as File & { 
            fileSet: FileSetType 
        };

        const fileSet = file?.fileSet;
        if (!file || !fileSet) throw new ControlledError({
            message: '삭제되었거나 존재하지 않는 이미지입니다.',
            alertOptions: { type: 'fail', duration: 3000 }
        });

        const filePath = FileProcessor.generateFilePath(fileSet.basePathKey!, fileSet.id!.toString(), file.saveName! + file.extension!);

        return await this.sendArchive({
            response: rep,
            fileInjectCallback: async (archive) => {
                const key = `${file.id}`;
                archive.file(filePath, { name: key });
            }
        })
       
    }

    static async sendFileAsDownload(fileId: number | string, rep: FastifyReply) {
        const file = await FileModel.findByPk(fileId, {
            include: [
                {
                    model: FileSet,
                    foreignKey: 'fileSetId',
                    as: 'fileSet'
                }
            ],
        }) as File & { fileSet: FileSetType };
    
        const fileSet = file?.fileSet;
        if (!file || !fileSet) throw new ControlledError({
            message: '삭제되었거나 존재하지 않는 파일입니다.',
            alertOptions: { type: 'fail', duration: 3000 }
        });
    
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
        const timestampedFileName = `${timestamp}${file.extension}`;
        const contentDisposition = `attachment; filename="${timestampedFileName}"`; //filename* UTF 추가하면 아이폰에서 다운로드 안됨
        rep.header("Content-Disposition", contentDisposition);
    
        const mimeModule = await import('mime');
        const mime = mimeModule.default;
        const mimeType = mime.getType(file.extension!) || 'application/octet-stream';
        rep.header("Content-Type", mimeType);
    
        const savedFileName = file.saveName! + file.extension!;
        const realPath = FileProcessor.generateFilePath(fileSet.basePathKey!, fileSet.id!.toString(), savedFileName);
    
        const stream = fs.createReadStream(realPath);
        return await rep.send(stream);
    }

    static async sendArchive(args: { response: FastifyReply, options?: ArchivingOptions, fileInjectCallback: (archive: archiver.Archiver) => Promise<void> }) {
        try {
            const { response, options, fileInjectCallback } = args;

            response.header("Content-Type", options?.contentType || "application/zip");

            const archive = archiver((options?.format || "zip") as archiver.Format, {
                zlib: { level: options?.zipLevel || 6 },
            });

            archive.pipe(response.raw);

            // 파일 추가는 콜백 함수를 통해 처리
            await fileInjectCallback(archive);
            await archive.finalize();
        } catch (error) {
            throw error;
        }
    }

}