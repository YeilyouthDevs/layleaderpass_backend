export enum ProcessWorkType {
    CREATE = "CREATE",
    DELETE = "DELETE",
    EDIT = "EDIT"
}

export type UploadID = string;

export type FilePaths = {
    temp: string[];
    deleted: string[];
    saved: string[];
}

export interface FileProcessCMD { //filemeta
    workType: ProcessWorkType;
    id?: number;
    uploadId?: UploadID;
    originId?: number;
    order: number;
}

export interface RawFileMeta {
    id?: number;
    uploadId: string;
    fileName: string;
    ext: string;
}

export interface FileMeta { //fileinfo
    id?: number;
    uploadId: string;
    fileName: string;
    saveName: string;
    ext: string;
    tempFilePath: string;
    order?: number;
    path?: string;
}

export interface FileProcessResult {
    fileSetId: number | null;
    data: any;
}

export interface FileProcessOption {
    maxFileCount?: number;
}