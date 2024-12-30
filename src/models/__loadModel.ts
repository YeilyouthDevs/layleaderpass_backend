//__loadModel.ts

import { Sequelize } from "sequelize";
import { File } from "../models/file";
import { initAdminLog } from './adminLog';
import { Category, initCategory } from './category';
import { initCountCache } from './countCache';
import { initFile } from './file';
import { FileSet, initFileSet } from './fileSet';
import { Notice, initNotice } from "./notice";
import { initSeason } from './season';
import { TalentAssignment, initTalentAssignment } from './talentAssignment';
import { TalentSum, initTalentSum } from './talentSum';
import { Training, initTraining } from './training';
import { TrainingType, initTrainingType } from './trainingType';
import { User, initUser } from './user';
import { UserSubmission, initUserSubmission } from "./userSubmission";


export function loadModels(sequelize: Sequelize) {
    initCountCache(sequelize);
    initSeason(sequelize);
    initAdminLog(sequelize);
    initUser(sequelize);
    initCategory(sequelize);
    initTrainingType(sequelize);
    initTraining(sequelize);
    initTalentSum(sequelize);
    initTalentAssignment(sequelize);
    initFileSet(sequelize);
    initFile(sequelize);
    initUserSubmission(sequelize);
    initNotice(sequelize);

    setupRelations();
}

function setupRelations() {
    
    // Category 관계 설정
    Category.hasMany(TrainingType, { foreignKey: 'categoryId', as: 'trainingSchemas' });
    Training.belongsTo(Category, { foreignKey: 'categoryId' });

    // TrainingType 관계 설정
    TrainingType.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
    TrainingType.hasMany(Training, { foreignKey: 'trainingTypeId', as: 'trainings' });

    // Training 관계 설정
    Training.belongsTo(TrainingType, { foreignKey: 'trainingTypeId', as: 'trainingType' });
    Training.hasMany(UserSubmission, { foreignKey: 'trainingId', as: 'userSubmissions' });
    Training.hasMany(TalentSum, { foreignKey: 'trainingId', as: 'talentSums' });

    // TalentAssignment 관계 설정
    TalentAssignment.belongsTo(User, { foreignKey: 'userEmail', as: 'user' });
    TalentAssignment.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
    TalentAssignment.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });

    // TalentSum 관계 설정
    TalentSum.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
    TalentSum.belongsTo(User, { foreignKey: 'userEmail', as: 'user' });

    // User 관계 설정
    User.hasMany(TalentSum, { foreignKey: 'userEmail', as: 'talentSums' });
    User.hasMany(TalentAssignment, { foreignKey: 'userEmail', as: 'talentAssignments' });
    User.hasMany(UserSubmission, { foreignKey: 'userSubmissions' });

    // FileSet 관계 설정
    FileSet.hasMany(File, { foreignKey: 'fileSetId', as: 'files' });
    FileSet.belongsTo(Notice, { foreignKey: 'fileSetId', targetKey: 'id', as: 'notice' });
    
    //FIXME FileSet - Training 이 없음?

    // File 관계 설정
    File.belongsTo(FileSet, { foreignKey: 'fileSetId', as: 'fileSet' });
    File.hasOne(File, { foreignKey: 'originId', as: 'thumbnail' });
    File.belongsTo(File, { foreignKey: 'originId', as: 'origin' });

    // UserSubmission 관계 설정
    UserSubmission.belongsTo(User, { foreignKey: 'userEmail', as: 'user' });
    UserSubmission.belongsTo(Training, { foreignKey: 'trainingId', as: 'training' });
    UserSubmission.belongsTo(FileSet, { foreignKey: 'fileSetId', as: 'fileSet' });
    UserSubmission.hasOne(TalentAssignment, { foreignKey: 'id', sourceKey: 'talentAssignmentId', as: 'talentAssignment' });
}