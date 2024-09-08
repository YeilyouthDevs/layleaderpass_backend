import fs from 'fs-extra'
import util from "util";
import { pipeline } from "stream";
import { FileMeta, FilePaths, FileProcessCMD, FileProcessOption, FileProcessResult, ProcessWorkType, RawFileMeta, UploadID } from './structures';
import { IndexHints, Transaction } from 'sequelize';
import { FastifyRequest } from "fastify";
import { v4 } from "uuid";
import path from "path";
import { FileSet } from "@/models/fileSet";
import { File as FileModel, FileType } from '@/models/file';
import Jimp from "jimp";
import { ControlledError } from "@/controlledError";
import { isProduct } from "@/configs/envConfig";
import { FILE_BASE_DEFAULT, TEST_FILE_BASE_DEFAULT, TEMP_FILE_PATH, TEST_TEMP_FILE_PATH } from '../../configs/envConfig';

// 상수 정의
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILENAME_LENGTH = 255;
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"];
const NOT_ALLOW_EXTENSIONS = ["", ".exe", ".msi", ".bat", ".sh"];

// 환경 변수에서 파일 경로 가져오기
const fileBaseDirKey = isProduct ? "FILE_BASE_DEFAULT" : "TEST_FILE_BASE_DEFAULT";
const fileBaseDir = isProduct ? FILE_BASE_DEFAULT : TEST_FILE_BASE_DEFAULT;
const tempBaseDir = isProduct ? TEMP_FILE_PATH : TEST_TEMP_FILE_PATH;


// 개발 환경에서는 폴더를 비웁니다.
// if (!isProduct) {
//     fs.emptyDirSync(fileBaseDir);
//     fs.emptyDirSync(tempBaseDir);
// }

const pump = util.promisify(pipeline);


/**
 * @example
const transaction = await sequelize.transaction();
const fileProcessor = new FileProcessor(transaction);

try {
    const fileSaveResult = await fileProcessor.save(request);
    // OR
    await fileProcessor.destroy(fileSetId);

    //...

    //필수
    await fileProcessor.commit();
} catch(error) {
    await fileProcessor.rollback();
    await transaction.rollback();
}
 */
export class FileProcessor {
    private paths: FilePaths;
    private metaMap: Map<UploadID, FileMeta>;
    private processCmds?: FileProcessCMD[];
    private fileSet?: FileSet | null;
    private fileSetId: number | null;
    private fileSetPath?: string;
    private jsonData?: any;
    private transaction: Transaction;
    private option?: FileProcessOption;

    constructor(transaction: Transaction, option?: FileProcessOption) {
        this.option = option;
        this.paths = {
            temp: [], deleted: [], saved: []
        };
        this.metaMap = new Map();
        this.fileSetId = null;
        this.transaction = transaction;
    }

    /** 파일을 저장함과 동시에 동기화함, 파일셋이 빈 경우 파일셋을 삭제함 */
    async save(req: FastifyRequest): Promise<FileProcessResult> {
        await this.handleFileUpload(req);
        await this.syncWithFileSystem();

        return {
            fileSetId: this.fileSetId!,
            data: this.jsonData
        };
    }

    /** 자원을 정리하고 마무리 함 */
    async finish() {
        await this.cleanFilesByPaths(this.paths.temp);
        await this.cleanFilesByPaths(this.paths.deleted);
    }

    /** 저장된 파일 및 변경사항을 리셋함 */
    async reset() {
        await this.cleanFilesByPaths(this.paths.saved);

        if (this.fileSetPath) {
            await this.restoreDeletedFiles(this.fileSetPath);

            //파일셋이 비어있으면 폴더를 삭제함
            const files = await fs.readdir(this.fileSetPath);
            if (files.length === 0) await fs.remove(this.fileSetPath);
        }
    }

    async destroy(fileSetId: number | null) {
        if (!fileSetId) return;

        const fileSet = await FileSet.findByPk(fileSetId, {
            lock: Transaction.LOCK.UPDATE,
            transaction: this.transaction
        });
        if (!fileSet) return;

        this.fileSet = fileSet;
        this.fileSetId = fileSet.id;
        this.fileSetPath = path.join(fileBaseDir, fileSet.id.toString());

        const files = await FileModel.findAll({
            attributes: ['id', 'saveName', 'extension'],
            where: { fileSetId: fileSet.id },
            indexHints: [{ type: IndexHints.FORCE, values: ['fileSetId'] }],
            lock: Transaction.LOCK.UPDATE,
            transaction: this.transaction
        })
        
        let promises = [];
        const fileCRUD = new FileCRUD(fileSet, this.paths, this.transaction);

        for (const file of files) {
            promises.push(fileCRUD.deleteFile({ fileModel: file }));
        }

        promises.push(fileSet.destroy({ transaction: this.transaction }))

        await Promise.all(promises);
        await fs.remove(this.fileSetPath);
    }

    private async handleFileUpload(req: FastifyRequest) {
        const parts = req.parts({ limits: { fileSize: MAX_FILE_SIZE } });

        for await (const part of parts) {
            await this.parseFields(part.fields);

            if (part.type === 'file') {
                const fileMeta = await this.saveTemporaryFile(part);
                this.metaMap.set(fileMeta.uploadId, fileMeta);
            }
        }
    }

    private async syncWithFileSystem() {
        if (!this.transaction) throw new Error('트랜잭션 없음');

        this.fileSet = await this.getOrCreateFileSet();
        this.fileSetId = this.fileSet.id;

        await this.processFileOperations();
    }

    private async getOrCreateFileSet(): Promise<FileSet> {
        let fileSet;

        if (this.fileSetId) {
            fileSet = await FileSet.findByPk(this.fileSetId, {
                lock: Transaction.LOCK.UPDATE,
                transaction: this.transaction
            });
        }

        if (!fileSet) {
            fileSet = await FileSet.create({ basePathKey: fileBaseDirKey }, { transaction: this.transaction });
        }

        if (fileSet) {
            this.fileSetPath = path.join(fileBaseDir, fileSet.id.toString());
            return fileSet;
        }

        throw new Error('FileSet 없음');
    }

    private async processFileOperations() {
        if (!this.fileSetPath || !this.fileSet || !this.processCmds) throw new Error('필수 변수 없음');
        await fs.ensureDir(this.fileSetPath);

        const toBeFileCount = await this.validateFileCount(this.processCmds, this.fileSet);
        const fileCRUD = new FileCRUD(this.fileSet, this.paths, this.transaction!);

        let processPromises = [];
        for (const cmd of this.processCmds) {
            if (cmd.workType === ProcessWorkType.CREATE){
                const fileMeta = this.metaMap.get(cmd.uploadId!)!;
                fileMeta.path = path.join(this.fileSetPath, `${fileMeta.saveName}${fileMeta.ext}`);
                processPromises.push(fileCRUD.createFile(fileMeta, cmd));
            } else if (cmd.workType === ProcessWorkType.DELETE) {
                if (cmd.id) processPromises.push(fileCRUD.deleteFile({ fileId: cmd.id}));
                if (cmd.originId) processPromises.push(fileCRUD.deleteFile({ fileId: cmd.originId}));
            } else if (cmd.workType === ProcessWorkType.EDIT) {
                processPromises.push(fileCRUD.editFile(cmd));
            }
        }

        await Promise.all(processPromises);

        if (toBeFileCount === 0) {
            await this.deleteFileSetAndDirectory(this.fileSet, this.fileSetPath);
        }
    }

    private async validateFileCount(processCmds: FileProcessCMD[], fileSet: FileSet): Promise<number> {
        const currentFileCount = await FileProcessor.getFileCount(fileSet, this.transaction!);
        const maxFileCount = this.option?.maxFileCount;
        let changeFileCount = 0;
    
        for (const cmd of processCmds) {
            if (cmd.workType === ProcessWorkType.CREATE) {
                changeFileCount++;
            } else if (cmd.workType === ProcessWorkType.DELETE) {
                changeFileCount--;
            }
        }
    
        const toBeFileCount = currentFileCount + changeFileCount;
        if (maxFileCount && toBeFileCount > maxFileCount) {
            throw new ControlledError({
                message: `최대 ${maxFileCount} 개 파일만 업로드할 수 있습니다.`,
                alertOptions: { type: 'warn', duration: 4000 }
            });
        }
    
        return toBeFileCount;
    }

    private async deleteFileSetAndDirectory(fileSet: FileSet, fileSetPath: string) {
        await fs.remove(fileSetPath);
        await fileSet.destroy({ transaction: this.transaction! });
        this.fileSet = null;
        this.fileSetId = null;
    }

    private async restoreDeletedFiles(fileSetPath: string) {
        await fs.ensureDir(fileSetPath);

        let restorePromises = this.paths.deleted.map(async (backupPath) => {
            const baseName = path.basename(backupPath);
            const originalPath = path.join(fileSetPath, baseName);

            await fs.copy(backupPath, originalPath, { overwrite: true });
            await fs.remove(backupPath);
        });

        await Promise.all(restorePromises);
    }

    private async cleanFilesByPaths(filePaths: string[]) {
        let deletePromises = filePaths.map(filePath => fs.remove(filePath));
        await Promise.all(deletePromises);
    }

    private async saveTemporaryFile(part: any): Promise<FileMeta> {
        const rawFileMeta = FileProcessor.extractRawFileMeta(part.filename);
        const saveName = v4();
        const tempFilePath = path.join(tempBaseDir, saveName + rawFileMeta.ext);

        await fs.ensureDir(path.dirname(tempFilePath));

        const tempStream = fs.createWriteStream(tempFilePath);

        try {
            FileProcessor.validateFile(part, rawFileMeta);
            await pump(part.file, tempStream);
            this.paths.temp.push(tempFilePath);
        } catch (error) {
            tempStream.destroy();
            await fs.remove(tempFilePath);
            throw error;
        } finally {
            tempStream.end();
        }

        return {
            ...rawFileMeta,
            tempFilePath,
            saveName
        };
    }

    private async parseFields(fields: any) {
        const fileSetId = fields['fileSetId'];
        if (!this.fileSetId && fileSetId) {
            this.fileSetId = parseInt(fileSetId.value);
        }

        const processCmds = fields['processCmds'];
        if (!this.processCmds && processCmds) {
            this.processCmds = JSON.parse(processCmds.value);
        }

        const jsonData = fields['jsonData'];
        if (!this.jsonData && jsonData) {
            this.jsonData = JSON.parse(jsonData.value);
        }
    }

    static generateFilePath(baseDirKey: string, ...pathSegments: string[]): string {
        const basePath = process.env[baseDirKey] || fileBaseDir;
        return path.join(basePath, ...pathSegments);
    }

    private static async getFileCount(fileSet: FileSet, transaction: Transaction) {
        const files = await FileModel.findAll({
            attributes: ['id'],
            where: {
                fileSetId: fileSet.id,
                originId: null
            },
            indexHints: [{ type: IndexHints.FORCE, values: ['fileSetId'] }],
            transaction
        });

        return files.length;
    }

    private static extractRawFileMeta(fileName: string): RawFileMeta {
        const parts = fileName.split('|');
        const idPart = parts[0];
        const uploadId = parts[1];
        const nameWithExt = parts.slice(2).join('|');

        const numberizedId = Number(idPart);
        const id = isNaN(numberizedId) ? undefined : numberizedId;
        const extFivotIdx = nameWithExt.lastIndexOf('.');

        let pureName: string;
        let ext: string;

        if (extFivotIdx > 0) {
            pureName = nameWithExt.substring(0, extFivotIdx);
            ext = nameWithExt.substring(extFivotIdx);
        } else {
            pureName = nameWithExt;
            ext = '';
        }

        return { id, uploadId, fileName: pureName, ext };
    }

    private static validateFile(part: any, rawFileMeta: RawFileMeta) {
        const fileName = part.filename.split('|').pop();

        if (part.filename.length > MAX_FILENAME_LENGTH) {
            throw new ControlledError({
                message: `파일 이름이 너무 깁니다: ${fileName}`,
                alertOptions: { type: 'warn', duration: 4000 }
            });
        } else if (NOT_ALLOW_EXTENSIONS.includes(rawFileMeta.ext.toLowerCase())) {
            throw new ControlledError({
                message: `업로드 할 수 없는 확장자 입니다: ${fileName}`,
                alertOptions: { type: 'warn', duration: 4000 }
            });
        }
    }
}

/** 파일의 CRUD 메서드를 모아놓은 클래스 */
export class FileCRUD {
    private transaction: Transaction;
    private fileSet: FileSet;
    private paths: FilePaths;

    constructor(fileSet: FileSet, paths: FilePaths, transaction: Transaction) {
        this.fileSet = fileSet;
        this.paths = paths;
        this.transaction = transaction;
    }

    async createFile(fileMeta: FileMeta, processCmd: FileProcessCMD) {
        if (!fileMeta.path) throw new Error('최종 저장 경로가 없음');

        const originId = await this.saveFileToFinalPath(fileMeta, processCmd);

        if (originId) {
            await this.generateThumbnail(fileMeta, processCmd, originId);
        }
    }

    async deleteFile(arg: {fileModel?: FileModel, fileId?: number}) {
        let toDeleteFile;
        if (arg.fileModel) toDeleteFile = arg.fileModel;
        else toDeleteFile = await FileModel.findByPk(arg.fileId, { transaction: this.transaction });

        if (toDeleteFile) {
            const filePath = path.join(fileBaseDir, this.fileSet.id.toString(), toDeleteFile.saveName! + toDeleteFile.extension!);
            const backupPath = path.join(tempBaseDir, toDeleteFile.saveName! + toDeleteFile.extension!);

            await fs.copy(filePath, backupPath);

            this.paths.deleted.push(backupPath);

            await toDeleteFile.destroy({ transaction: this.transaction });
            await fs.remove(filePath);
        }
    }

    async editFile(processCmd: FileProcessCMD) {
        const existsFile = await FileModel.findByPk(processCmd.id, {
            attributes: ['id', 'order'],
            lock: Transaction.LOCK.UPDATE,
            transaction: this.transaction
        });

        if (existsFile) {
            existsFile.order = processCmd.order;
            await existsFile.save({ transaction: this.transaction });
        }

        if (processCmd.originId) {
            const existsOriginFile = await FileModel.findByPk(processCmd.originId, {
                attributes: ['id', 'order'],
                lock: Transaction.LOCK.UPDATE,
                transaction: this.transaction
            });

            if (existsOriginFile) {
                existsOriginFile.order = processCmd.order;
                await existsOriginFile.save({ transaction: this.transaction });
            }
        }
    }

    private async saveFileToFinalPath(fileMeta: FileMeta, processCmd: FileProcessCMD): Promise<number> {
        const newFile: FileType = {
            fileSetId: this.fileSet.id,
            extension: fileMeta.ext,
            originalName: fileMeta.fileName,
            saveName: fileMeta.saveName,
            order: processCmd.order
        };

        if (IMAGE_EXTENSIONS.includes(fileMeta.ext.toLocaleLowerCase())) {
            newFile.isImage = true;
        }

        const createdFile = await FileModel.create(newFile, { transaction: this.transaction });
        await fs.move(fileMeta.tempFilePath, fileMeta.path!, { overwrite: true });
        this.paths.saved.push(fileMeta.path!);

        if (!createdFile?.id) throw new Error('File 모델 생성되지 않음');
        return createdFile.id;
    }

    private async generateThumbnail(fileMeta: FileMeta, processCmd: FileProcessCMD, originId: number) {
        if (IMAGE_EXTENSIONS.includes(fileMeta.ext.toLowerCase())) {
            await FileModel.create({
                fileSetId: this.fileSet.id,
                extension: fileMeta.ext,
                originalName: fileMeta.fileName,
                saveName: "thumb_" + fileMeta.saveName,
                isImage: true,
                originId,
                order: processCmd.order,
            }, { transaction: this.transaction });

            const thumbnailPath = path.join(fileBaseDir, this.fileSet.id.toString(), 'thumb_' + fileMeta.saveName + fileMeta.ext);
            const image = await Jimp.read(fileMeta.path!);
            image.resize(200, Jimp.AUTO).quality(70).write(thumbnailPath);
            this.paths.saved.push(thumbnailPath);
        }
    }
}