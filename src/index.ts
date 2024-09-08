
// index.ts
import './configs/envConfig'; //환경변수 로딩을 위해 먼저 import
import { isTest, isProduct } from './configs/envConfig';
if (isProduct) require('module-alias/register');
//---------------------------------------------------------------------------

import * as accountManageController from './controllers/accountManageController';
import * as developerController from './controllers/developerController';
import * as fileController from './controllers/fileController';
import * as findAccountController from './controllers/findAccountController';
import * as homeController from './controllers/homeController';
import * as mypageController from './controllers/mypageController';
import * as mySubmissionManageController from './controllers/mySubmissionManageController';
import * as myTalentAssignmentsController from './controllers/myTalentAssignmentsController';
import * as noticeController from './controllers/noticeController';
import * as regAcceptController from './controllers/registerAcceptionController';
import * as registerController from './controllers/registerController';
import * as seasonManageController from './controllers/seasonManageController';
import * as sessionController from './controllers/sessionController';
import * as staticController from './controllers/staticController';
import * as submissionController from './controllers/submissionController';
import * as submissionManageController from './controllers/submissionManageController';
import * as talentAssignmentManageController from './controllers/talentAssignmentManageController';
import * as testController from './controllers/testController';
import * as trainingController from './controllers/trainingController';
import * as trainingManageController from './controllers/trainingManageController';
import * as trainingTypeManageController from './controllers/trainingTypeManageController';
import * as userController from './controllers/userController';

import { startListen, stopListen } from "./configs/fastifyConfig";
import { connectDatabase, disconnectDatabase } from "./configs/sequelizeConfig";
import { setUseMail } from "./lib/mail";

//---------------------------------------------------------------------------

function enrollControllers() {
    userController.enroll();
    registerController.enroll();
    sessionController.enroll();
    regAcceptController.enroll();
    accountManageController.enroll();
    seasonManageController.enroll();
    trainingTypeManageController.enroll();
    staticController.enroll();
    trainingController.enroll();
    trainingManageController.enroll();
    fileController.enroll();
    submissionController.enroll();
    submissionManageController.enroll();
    noticeController.enroll();
    mypageController.enroll();
    mySubmissionManageController.enroll();
    findAccountController.enroll();
    myTalentAssignmentsController.enroll();
    talentAssignmentManageController.enroll();
    testController.enroll();
    homeController.enroll();
    developerController.enroll();
}

export async function startServer() {
    setUseMail(true);

    enrollControllers();
    await startListen();
    await connectDatabase();
}

export async function stopServer() {
    stopListen();
    await disconnectDatabase();
}

if (!isTest) startServer();