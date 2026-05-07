import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { adminService } from "./admin.service";
import sendResponse from "../../../shared/sendResponse";

const loginAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.loginAdmin(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "admin successfully logged in",
    data: result,
  });
});

const getAllProviders = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, searchTerm } = req.query;

  const result = await adminService.getAllProviders(
    searchTerm ? String(searchTerm) : "",
    page ? Number(page) : 1,
    limit ? Number(limit) : 10
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Pending providers retrieved successfully",
    data: result,
  });
});

const getAllFacility = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, searchTerm } = req.query;

  const result = await adminService.getAllFacility(
    searchTerm ? String(searchTerm) : "",
    page ? Number(page) : 1,
    limit ? Number(limit) : 10
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Facilities retrieved successfully",
    data: result,
  });
});

const userStatusUpdate = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.userStatusUpdate(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User status updated successfully",
    data: result,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.deleteUser(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User deleted successfully",
    data: result,
  });
});

const getAllJobsForAdmin = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, searchTerm } = req.query;

  const result = await adminService.getAllJobsForAdmin(
    searchTerm ? String(searchTerm) : "",
    page ? Number(page) : 1,
    limit ? Number(limit) : 10
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Jobs retrieved successfully",
    data: result,
  });
});

const deleteJobByAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.deleteJobByAdmin(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job deleted successfully",
    data: result,
  });
});

const editJobByAdmin = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.editJobByAdmin(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Job updated successfully",
    data: result,
  });
});

const getAllRatingsForAdmin = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit, searchTerm } = req.query;

    const result = await adminService.getAllRatingsForAdmin(
      searchTerm ? String(searchTerm) : "",
      page ? Number(page) : 1,
      limit ? Number(limit) : 10
    );

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Ratings retrieved successfully",
      data: result,
    });
  }
);

const deleteRating = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await adminService.deleteRating(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Rating deleted successfully",
    data: result,
  });
});

const updateAdmin = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.updateAdmin(req.user.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin updated successfully",
    data: result,
  });
});

const getDashboardHeaderNumbers = catchAsync(
  async (req: Request, res: Response) => {
    const result = await adminService.getDashboardHeaderNumbers();
    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Dashboard header numbers retrieved successfully",
      data: result,
    });
  }
);

const getUserSubscrption = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, searchQuery } = req.query;
  const result = await adminService.getUserSubscrption(
    Number(page),
    Number(limit),
    searchQuery as string
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "user sbuscrptoin plan get successfully",
    data: result,
  });
});

const adminDashboardData = catchAsync(async (req: Request, res: Response) => {
  const result = await adminService.adminDashboardData(
    req.query.filter as string
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "user dashboard data get successfully",
    data: result,
  });
});

export const adminController = {
  loginAdmin,
  getAllProviders,
  getAllFacility,
  getAllRatingsForAdmin,
  getAllJobsForAdmin,
  userStatusUpdate,
  deleteUser,
  deleteJobByAdmin,
  editJobByAdmin,
  deleteRating,
  updateAdmin,
  getDashboardHeaderNumbers,
  getUserSubscrption,
  adminDashboardData,
};
