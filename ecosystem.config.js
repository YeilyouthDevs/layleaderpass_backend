module.exports = {
  apps: [
    {
      name: 'production',
      script: './backend-build/index.js',
      node_args: '-r tsconfig-paths/register',
      env: {
        NODE_ENV: 'production',  // 기본적으로 production 환경으로 설정
        RUNTIME: 'PRODUCT'
      },
    },
    {
      name: 'preview',
      script: './backend-build/index.js',
      node_args: '-r tsconfig-paths/register',
      env: {
        NODE_ENV: 'production',  // 이 환경변수는 그대로 두고
        RUNTIME: 'PREVIEW'       // RUNTIME만 DEVELOP으로 변경
      },
    }
  ]
};