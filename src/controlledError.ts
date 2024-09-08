import { FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";

type AlertType = 'info' | 'warn' | 'fail' | 'error' | 'success'

export interface ResponseError {
  errType: string;
  status: number;
  errUUID: string;
  message?: string;
  timestamp: string;
  alertOptions?: AlertOptions;
}

interface AlertOptions {
  type?: AlertType;
  title?: string;
  duration?: number;
}

export class ControlledError extends Error {
  payload: ResponseError;

  constructor(payload: { message: string, status?: number, alertOptions?: AlertOptions }) {
    super(payload.message);
    const errUUID = uuidv4(); 
    this.payload = {
      errType: 'ControlledError',
      status: payload.status ?? 500,
      message: payload.message,
      errUUID, 
      timestamp: new Date().toISOString(),
      alertOptions: payload.alertOptions ?? { type: 'error', title: undefined, duration: 3000},
    };
  }

  static async catch(
    reply: FastifyReply,
    givenError: any,
    defaultErrorOrHandler: Record<string, any> | ((reply: FastifyReply, error: any) => Promise<void>)
  ): Promise<void> {
    if (givenError instanceof ControlledError) {
      reply.status(givenError.payload.status).send(givenError.payload);
    } else if (typeof defaultErrorOrHandler === "function") {
      console.debug(`에러 핸들러 처리: ${givenError.message}`);
      await defaultErrorOrHandler(reply, givenError); 
    } else {
      const errUUID = uuidv4(); 
      const timestamp = new Date().toISOString();
      const status = defaultErrorOrHandler.status ?? 500;
      reply.status(status).send({
        errType: 'Error',
        errUUID,
        timestamp, 
        ...defaultErrorOrHandler
      });
      console.error({ errUUID, timestamp, status }, givenError);
    }
  }
}