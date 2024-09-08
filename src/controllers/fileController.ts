import { app } from "@/configs/fastifyConfig";
import { ControlledError } from "@/controlledError";
import { UserRole } from "@/enums/userRole";
import { ensureNotEmpty } from "@/lib/validation";
import { checkRole } from "@/middlewares/checkRole";
import { checkSession } from "@/middlewares/checkSession";
import { FileSendService } from "@/services/FileSendService";

export function enroll() {
  app.get(
    "/api/file/fetchFileSet",
    {
      preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
    },
    async (req, rep) => {
      rep.header("x-skip-catch", true); //클라이언트 오류 캐치 스킵

      try {
        const { fileSetId } = req.query as any;
        ensureNotEmpty([fileSetId]);

        const data = await FileSendService.sendFileSet(fileSetId);
        rep.send(data)
      } catch (error) {
        ControlledError.catch(rep, error, {
          message: "파일 목록을 가져오는 중 오류 발생",
        });
      }
    }
  );

  app.get(
    "/api/file/fetchThumbnails",
    {
      preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
    },
    async (req, rep) => {
      try {
        const { fileSetId } = req.query as any;
        ensureNotEmpty([fileSetId]);

        await FileSendService.sendThumbnails(fileSetId, rep)
      } catch (error) {
        ControlledError.catch(rep, error, {
          message: "썸네일 다운로드 중 오류 발생",
        });
      }
    }
  );

  app.get(
    "/api/file/fetchImage",
    {
      preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
    },
    async (req, rep) => {
      try {
        const { fileId } = req.query as any;
        ensureNotEmpty([fileId]);

        await FileSendService.sendImage(fileId, rep);
      } catch (error) {
        ControlledError.catch(rep, error, {
          message: "이미지 다운로드 중 오류 발생",
        });
      }
    }
  );

  app.get(
    "/api/file/download",
    {
      preHandler: [checkSession(), checkRole({ min: UserRole.USER })],
    },
    async (req, rep) => {
      try {
        const { fileId } = req.query as any;
        ensureNotEmpty([fileId]);

        await FileSendService.sendFileAsDownload(fileId, rep);
      } catch (error) {
        ControlledError.catch(rep, error, {
          message: "파일 다운로드 중 오류 발생",
        });
      }
    }
  );
}
