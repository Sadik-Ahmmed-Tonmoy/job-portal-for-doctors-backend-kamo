import express from "express";
import { communityController } from "./community.controller";
import auth from "../../middlewares/auth";
import { fileUploader } from "../../../helpers/fileUploader";
import { parseBodyData } from "../../middlewares/parseBodyData";

const router = express.Router();

router.post(
  "/create-post",
  auth(),
  fileUploader.communityPostDoc,
  parseBodyData,
  communityController.createPost
);

router.get("/get-all-post", auth(), communityController.getAllPost);
router.post("/post-comment", auth(), communityController.postComment);
router.post("/post-like", auth(), communityController.postLike);

router.get("/get-post-by-id/:postId", auth(), communityController.getPostById);
router.get("/get-user-post", auth(), communityController.getUserPost);
router.patch("/update-single-post/:postId",auth(),  fileUploader.communityPostDoc,parseBodyData,communityController.updatePost)
router.delete("/delete-single-post/:postId",auth(),communityController.deletePost)
export const communityRoute = router;
