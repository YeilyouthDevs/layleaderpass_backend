import { FastifyReply, FastifyRequest } from "fastify";
import Joi, { ValidationError, ValidationOptions } from "joi";

// 검증 함수
export function createValidator(
  schema: Joi.ObjectSchema,
  validateOption: ValidationOptions & { includeHeaders?: boolean } = { abortEarly: true }
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      let dataToValidate = req.body as object;

      // 명시적인 메소드 이름 사용으로 가독성 향상
      if (req.method === "GET" || req.method === "DELETE") {
        dataToValidate = req.query as object;
      }

      // 헤더 포함 옵션 적용
      if (validateOption.includeHeaders) {
        dataToValidate = { ...dataToValidate, ...req.headers };
      }

      // Joi 유효성 검사 실행
      await schema.validateAsync(dataToValidate, { ...validateOption, includeHeader: undefined }); // includeHeader 제외

    } catch (err) {
      
      const error = err as ValidationError; // 타입 강화 적용
      reply.status(400).send({
        errType: "ValidationError",
        status: 400,
        message: error.message,
      });

      return reply;
    }
  };
}
