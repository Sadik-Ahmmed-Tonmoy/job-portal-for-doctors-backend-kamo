import { tryCatch } from "bullmq";
import { bullNotificationQueue } from "../../../helpers/redis";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { waitForDebugger } from "inspector";
import { ConnectionCheckOutStartedEvent } from "mongodb";

const createPost = async (payload: any) => {
  const result = await prisma.communityPost.create({
    data: {
      userId: payload.userId,

      content: payload.content,
      imageUrl: payload.imageUrl,
      videoUrl: payload.videoUrl,
    },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
    },
  });
  bullNotificationQueue.add("bull-notification-send", {
    communityPost: result,
  });

  return result;
};
const getAllPost = async (userId: string) => {
  const result = await prisma.communityPost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,

      likes: {
        where: {
          userId: userId,
        },
        select: {
          id: true,
          user: {
            select: {
              fullName: true,
              profileImage: true,
            },
          },
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },
      imageUrl: true,
      videoUrl: true,
      createdAt: true,
      type: true,
      user: {
        select: {
          fullName: true,
          profileImage: true,
        },
      },

      comments: {
        where: {
          parentCommentId: null,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },

          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return result;
};

const updatePost = async (postId: string, data: any, userId: string) => {
  console.log(data, "check data");
  console.log(postId);
  const post = await prisma.communityPost.findUnique({
    where: {
      id: postId,
    },
  });
  if (post?.userId !== userId) {
    throw new ApiError(
      httpStatus.NOT_ACCEPTABLE,
      "this post is not yours.you cannot delete it"
    );
  }
  const updatePost = await prisma.communityPost.update({
    where: {
      id: postId,
    },
    data: {
      ...data,
    },
  });
  return updatePost;
};

const deletePost = async (postId: string, userId: string) => {
  const post = await prisma.communityPost.findUnique({
    where: {
      id: postId,
    },
  });
  if (post?.userId !== userId) {
    throw new ApiError(
      httpStatus.NOT_ACCEPTABLE,
      "this post is not yours.you cannot delete it"
    );
  }

  const deletePost = await prisma.communityPost.delete({
    where: {
      id: postId,
    },
  });
  return deletePost;
};

const getUserPost = async (userId: string) => {
  const result = await prisma.communityPost.findMany({
    where: {
      userId: userId,
    },

    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      user: {
        select: {
          fullName: true,
          profileImage: true,
        },
      },
      // likes: {
      //   select: {
      //     id: true,
      //     user: {
      //       select: {
      //         fullName: true,
      //         profileImage: true,
      //       },
      //     },
      //   },
      // },

      likes: {
        where: {
          userId: userId,
        },
        select: {
          id: true,
          user: {
            select: {
              fullName: true,
              profileImage: true,
            },
          }, 
        },
      },
      _count: {
        select: { likes: true, comments: true },
      },

      imageUrl: true,
      videoUrl: true,
      createdAt: true,

      comments: {
        where: {
          parentCommentId: null,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },

          replies: {
            select: {
              id: true,
              content: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  profileImage: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return result;
};
const postComment = async (payload: any) => {
  const result = await prisma.comment.create({
    data: {
      parentCommentId: payload.parentCommentId,
      content: payload.content,
      userId: payload.userId,
      postId: payload.postId,
    },
  });
  return result;
};
const postLike = async (payload: { userId: string; postId: string }) => {
  const existingLike = await prisma.like.findUnique({
    where: {
      postId_userId: {
        postId: payload.postId,
        userId: payload.userId,
      },
    },
  });

  if (existingLike) {
    await prisma.like.delete({
      where: {
        id: existingLike.id,
      },
    });
    return { message: "Post unliked" };
  } else {
    await prisma.like.create({
      data: {
        userId: payload.userId,
        postId: payload.postId,
      },
    });
    return { message: "Post liked" };
  }
};
const getPostById = async (postId: string) => {
  const result = await prisma.communityPost.findUnique({
    where: {
      id: postId,
    },
    select: {
      id: true,
      createdAt: true,
      content: true,
      user: {
        select: {
          fullName: true,
          profileImage: true,
        },
      },
      comments: {
        select: {
          id: true,
          content: true,

          user: {
            select: {
              fullName: true,
              profileImage: true,
            },
          },
          createdAt: true,
        },
      },
    },
  });
  return result;
};
export const communityService = {
  createPost,
  getAllPost,
  postComment,
  postLike,
  getPostById,
  getUserPost,
  updatePost,
  deletePost,
};
