import { NextFunction, Request, Response } from "express";


export const injectFileIntoBody = (fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let file: Express.Multer.File | undefined;

    if (req.file) {
      file = req.file;
    } else if (Array.isArray(req.files)) {

      file = req.files.find((f: any) => f.fieldname === fieldName);
    } else if (req.files && typeof req.files === "object") {
     
      const filesByField = req.files as { [field: string]: Express.Multer.File[] };
      file = filesByField[fieldName]?.[0];
    }

    if (!file) {
      return next(); 
    }

    req.body[fieldName] = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      path: file.path,
      filename: file.filename,
    };

    next();
  };
};
