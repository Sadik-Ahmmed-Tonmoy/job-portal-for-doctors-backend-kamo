import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { ContactUsService } from "./contact.service";
import sendResponse from "../../../shared/sendResponse";
import httpStatus from "http-status";

const createContactUs = catchAsync(async(req: Request, res: Response) => {
    const result = await ContactUsService.createContactUs(req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Message sent successfully",
        data: result,
    });
})

export const ContactUsController = {
    createContactUs,
};