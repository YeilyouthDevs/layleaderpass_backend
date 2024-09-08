// developerController.ts

export function enroll() {
  // /**
  //  * 달란트 동기화
  //  */
  // app.get("/api/developer/syncTalent", {
  //   preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
  // }, async (req, rep) => {
  //   try {
  //     const { email } = req.headers;
  //     if (email !== SU_ID) throw Error('권한 없음')

  //     // await TalentService.synchronize();

  //     rep.send('Done'); // 조회된 사용자 데이터 반환
  //   } catch (error) {
  //     ControlledError.catch(rep, error, {
  //       message: "동기화 실패",
  //     });
  //   }
  // });

  // app.get("/api/developer/clearAlienFileSet", {
  //   preHandler: [ checkSession(), checkRole({ min: UserRole.ADMIN }) ]
  // }, async (req, rep) => {
  //   try {
  //     const { email } = req.headers;
  //     if (email !== SU_ID) throw Error('권한 없음')

  //     await FileManager.clearAlienFileSet();

  //     rep.send('Done'); // 조회된 사용자 데이터 반환
  //   } catch (error) {
  //     ControlledError.catch(rep, error, {
  //       message: "외계파일셋 제거 실패",
  //     });
  //   }
  // });

}
