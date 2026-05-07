import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { communityService } from "./community.service";
import { communityPostFileQueue } from "../../../helpers/redis";
import uploadToDigitalOcean from "../../../helpers/uploadToDigitalOcean";

const createPost = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  req.body.userId = userId;

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  if (files?.imageUrl || files?.videoUrl) {
    const imageFile = files?.imageUrl?.[0];
    const videoFile = files?.videoUrl?.[0];

    console.log(files?.imageUrl?.[0], "check files");

    // communityPostFileQueue.add("upload-community-media", {
    //   postId,
    //   image: imageFile,
    //   video: videoFile,
    // });
    if (files?.imageUrl?.[0]) {
      req.body.imageUrl = await uploadToDigitalOcean(files.imageUrl[0]);
    }

    if (files?.videoUrl?.[0]) {
      req.body.videoUrl = await uploadToDigitalOcean(files.videoUrl[0]);
    }
  }
  const result = await communityService.createPost({
    ...req.body,
  });



  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Post created successfully",
    data: result,
  });
});
const getAllPost = catchAsync(async (req: Request, res: Response) => {
  const response = await communityService.getAllPost(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "all post get successfully",
    data: response,
  });
});
const postComment = catchAsync(async (req: Request, res: Response) => {
  req.body.userId = req.user.id;
  const response = await communityService.postComment(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "post comment successfully",
    data: response,
  });
});
const postLike = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const postId = req.body.postId;
  const response = await communityService.postLike({ userId, postId });

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: response as unknown as string,
  });
});
const getPostById = catchAsync(async (req: Request, res: Response) => {
  req.body.userId = req.user.id;
  const response = await communityService.getPostById(
    req.params.postId as string
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "single post retrive successfully",
    data: response,
  });
});

const getUserPost = catchAsync(async (req: Request, res: Response) => {
  req.body.userId = req.user.id;
  const response = await communityService.getUserPost(req.user.id as string);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "user post retrive successfully",
    data: response,
  });
});
const updatePost = catchAsync(async (req: Request, res: Response) => {

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };
  if (files?.imageUrl || files?.videoUrl) {
 
    
    if (files?.imageUrl?.[0]) {
      req.body.imageUrl = await uploadToDigitalOcean(files.imageUrl[0]);
    }

    if (files?.videoUrl?.[0]) {
      req.body.videoUrl = await uploadToDigitalOcean(files.videoUrl[0]);
    }
  }
  const response = await communityService.updatePost(
    req.params.postId as string,
    req.body,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "user post update  successfully",
    data: response,
  });
});
const deletePost = catchAsync(async (req: Request, res: Response) => {
 
  const response = await communityService.deletePost(
    req.params.postId as string,
    req.user.id
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "user post deleted  successfully",
    data: response,
  });
});
export const communityController = {
  createPost,
  getAllPost,
  postComment,
  postLike,
  getPostById,
  getUserPost,
  updatePost,
  deletePost,
};
