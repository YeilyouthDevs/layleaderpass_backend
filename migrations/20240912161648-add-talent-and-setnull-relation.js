'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. User 테이블에 talent 필드 추가
    await queryInterface.addColumn('user', 'talent', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      comment: '현재 시즌 총 달란트 캐싱',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // 1. User 테이블에서 talent 필드 제거
    await queryInterface.removeColumn('user', 'talent');
  }
};
