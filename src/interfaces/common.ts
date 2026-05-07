import { IGenericErrorMessage } from "./error";


export type IGenericResponse<T> = {
  meta: {
    page: number;
    limit: number;
    total: number;
  };
  data: T;
};

export type IGenericErrorResponse = {
  statusCode: number;
  message: string;
  errorMessages: IGenericErrorMessage[];
};
export interface RedisMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  read?: boolean;
  updatedAt?: string;
  conversationId: string;
}