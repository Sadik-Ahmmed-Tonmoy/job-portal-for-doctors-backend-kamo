import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError, ZodTypeAny } from "zod";

const validateRequest = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
};

export default validateRequest;
