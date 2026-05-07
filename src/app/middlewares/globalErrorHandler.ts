import { Prisma } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import config from "../../config";
import { IGenericErrorMessage } from "../../interfaces/error";
import handleValidationError from "../../errors/handleValidationError";
import handleZodError from "../../errors/handleZodError";
import handleClientError from "../../errors/handleClientError";
import ApiError from "../../errors/ApiErrors";

const GlobalErrorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = error.message || "Something went wrong!";
  let errorMessages: IGenericErrorMessage[] = [];

  // Prisma Validation Error (e.g., invalid inputs)
  if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid input data. Please check the request payload.";
    const errorLines = error.message.split("\n");
    const lastLine = errorLines.slice(-1)[0];
    const fieldMatch = lastLine.match(/Argument `(.+?)`:/);
    const fieldName = fieldMatch ? fieldMatch[1] : "unknown_field";
    let developerMessage = lastLine.replace(`Argument \`${fieldName}\`: `, "");

    const fieldSpecificMessages: { [key: string]: string } = {
      [fieldName]: `Invalid \`${fieldName}\`. Expected a nested object or array of promo codes, not a string. Example: \`${fieldName}: [{ id: 'some-id' }]\`.`,
    };

    if (fieldSpecificMessages[fieldName]) {
      developerMessage = fieldSpecificMessages[fieldName];
    }

    errorMessages.push({
      path: fieldName,
      message: developerMessage,
    });
  }

  // Zod Schema Validation Error
  else if (error instanceof ZodError) {
    const simplifiedError = handleZodError(error);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorMessages = simplifiedError.errorMessages;
  }

  // Prisma Known Request Errors
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      // Record not found
      statusCode = httpStatus.NOT_FOUND;
      message = "Requested data not found.";
      errorMessages = [
        {
          path: "",
          message: "The requested record was not found in the database.",
        },
      ];
    } else if (error.code === "P2002") {
      let targetField = "unknown_field";

      if (typeof error.meta?.target === "string") {
        targetField = error.meta.target
          .replace(/^.*_/, "") // remove table prefix if exists
          .replace("_key", "");
      } else if (Array.isArray(error.meta?.target)) {
        targetField = error.meta.target[0];
      }

      statusCode = httpStatus.CONFLICT;
      message = `${targetField} already exists`;
      errorMessages = [
        {
          path: targetField,
          message: `A ${targetField} already exists.`,
        },
      ];
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Invalid input data. Please check the request payload.";
      const errorLines = error.message.split("\n");
      const lastLine = errorLines.slice(-1)[0];
      const fieldMatch = lastLine.match(/Argument `(.+?)`:/);
      const fieldName = fieldMatch ? fieldMatch[1] : "unknown_field";
      let developerMessage = lastLine.replace(
        `Argument \`${fieldName}\`: `,
        ""
      );
      errorMessages.push({
        path: fieldName,
        message: developerMessage,
      });
    }
  }

  // Custom Application Error
  else if (error instanceof ApiError) {
    statusCode = error?.statusCode;
    message = error.message;
    errorMessages = error?.message
      ? [
          {
            path: "",
            message: error?.message,
          },
        ]
      : [];
  }

  // JavaScript Standard Errors
  else if (error instanceof Error) {
    message = error?.message;
    errorMessages = error?.message
      ? [
          {
            path: "",
            message: error?.message,
          },
        ]
      : [];
  }

  // Prisma Initialization Errors
  else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "Failed to initialize Prisma Client. Check your DB connection.";
    errorMessages = [
      {
        path: "",
        message: "Failed to initialize Prisma Client.",
      },
    ];
  }

  // Prisma Rust Panic Error
  else if (error instanceof Prisma.PrismaClientRustPanicError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "A critical Prisma engine error occurred.";
    errorMessages = [
      {
        path: "",
        message: "Prisma Client Rust Panic Error",
      },
    ];
  }

  // Prisma Unknown Request Error
  else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "Unknown error while processing Prisma request.";
    errorMessages = [
      {
        path: "",
        message: "Prisma Client Unknown Request Error",
      },
    ];
  }

  // SyntaxError, TypeError, ReferenceError
  else if (error instanceof SyntaxError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Syntax error in request.";
    errorMessages = [
      {
        path: "",
        message: "Syntax Error",
      },
    ];
  } else if (error instanceof TypeError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Type error in application.";
    errorMessages = [
      {
        path: "",
        message: "Type Error",
      },
    ];
  } else if (error instanceof ReferenceError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Reference error in application.";
    errorMessages = [
      {
        path: "",
        message: "Reference Error",
      },
    ];
  }

  // Default fallback
  else {
    message = "An unexpected error occurred!";
    errorMessages = [
      {
        path: "",
        message: "An unexpected error occurred!",
      },
    ];
  }

  // Final error response
  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    err: error,
    stack: config.env !== "production" ? error?.stack : undefined,
  });
};

export default GlobalErrorHandler;
