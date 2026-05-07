import Stripe from "stripe";
import config from "../../../config";
import prisma from "../../../shared/prisma";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { CommunityType, Prisma, PromotionStatus } from "@prisma/client";
import { searchAndPaginate } from "../../../helpers/searchAndPaginate";
import { ConnectionCheckOutStartedEvent } from "mongodb";
import { Pay } from "twilio/lib/twiml/VoiceResponse";
import { generateUniqueTransactionId } from "../../../utlits/transactionIdGenerator";

const stripe = new Stripe(config.stripe.secretKey as string);
const createPromotion = async (payload: any, stripeCustomerId: string) => {
  const user = await prisma.user.findUnique({
    where: {
      id: payload.userId,
    },
    select: {
      facilityProfile: true,
    },
  });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "user not found");
  }
  if (!user.facilityProfile) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User has no facility profile");
  }

  try {
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: payload.email,
        name: payload.fullName,
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({
        where: { id: payload.userId },
        data: { stripeCustomerId: stripeCustomerId },
      });
    }
    await stripe.paymentMethods.attach(payload.paymentMethodId, {
      customer: stripeCustomerId,
    });
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: payload.paymentMethodId },
    });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Number(payload.value) * 100,
      currency: "usd",
      customer: stripeCustomerId,
      payment_method: payload.paymentMethodId,
      confirm: true,

      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });
    if (paymentIntent.status === "succeeded") {
      // const result = await prisma.promotion.create({
      //   data: {
      //     caption: payload.caption,
      //     endTime: payload.endTime,
      //     promotionImage: payload.promotionImage,
      //     promotionType: payload.promotionType,
      //     startTime: payload.startTime,
      //     facilityId: user?.facilityProfile?.id,
      //     value: payload.value,
      //     promotionStatus: "ACTIVE", //temporary purpose
      //   },
      // });

      const result = await prisma.$transaction(async (tr) => {
        let transactionId = await generateUniqueTransactionId();
        const promotion = await tr.promotion.create({
          data: {
            caption: payload.caption,
            endTime: payload.endTime,
            promotionImage: payload.promotionImage,
            promotionType: payload.promotionType,
            startTime: payload.startTime,

            facility: {
              connect: { id: user?.facilityProfile?.id },
            },
            value: payload.value,

            promotionStatus: "ACTIVE", //temporary purpose
          },
        });
        const payment = await prisma.payment.create({
          data: {
            amount: payload.value,
            paymentIntentId: paymentIntent.id,
            paymentType: "PROMOTION",
            transactionId: transactionId,
          },
        });
        return promotion;
      });
      return result;
    }
  } catch (error) {
    console.error(error, "Stripe payment error");
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Payment failed. Please try again.",
    );
  }
};

const updatePromotionStatus = async (
  promotionId: string,
  status: PromotionStatus,
) => {
  const promotion = await prisma.promotion.findUnique({
    where: {
      id: promotionId,
    },
  });

  if (!promotion) {
    throw new ApiError(httpStatus.NOT_FOUND, "Promotion not found");
  }

  const result = await prisma.promotion.update({
    where: {
      id: promotionId,
    },
    data: {
      promotionStatus: status,
    },
  });

  if (status === "ACTIVE") {
    await prisma.communityPost.create({
      data: {
        type: "PROMOTION",
        imageUrl: promotion.promotionImage,
        promotionId: promotion.id,
      },
    });
  }

  return result;
};

const getPromotion = (status: string, page: number, limit: number) => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let additionalFilter: Prisma.promotionWhereInput = {};
  if (status === "running") {
    additionalFilter = {
      ...additionalFilter,
      startTime: { lte: now },
      endTime: { gte: now },
      promotionStatus: "ACTIVE",
    };
  } else if (status === "history") {
    additionalFilter = {
      ...additionalFilter,
      endTime: { lt: now },
      promotionStatus: "ACTIVE",
    };
  }
  const promotion = searchAndPaginate<
    typeof prisma.promotion,
    Prisma.promotionWhereInput,
    Prisma.promotionSelect
  >(
    prisma.promotion,
    [],
    Number(page) || 1,
    Number(limit) || 10,
    "",
    additionalFilter,
    {
      select: {
        id: true,
        caption: true,
        endTime: true,
        promotionStatus: true,
        facility: {
          select: {
            facilityName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        promotionImage: true,
        promotionType: true,
      },
    },
  );
  return promotion;
};
const getPromotionByFacility = (
  userId: string,
  status: string,
  page: number,
  limit: number,
) => {
  let additionalFilter: Prisma.promotionWhereInput = {
    facility: {
      userId: userId,
    },
  };

  const now = new Date();
  console.log(now, "time now");
  // now.setHours(23, 59, 59, 999);
  if (status === "running") {
    console.log("status");

    additionalFilter = {
      ...additionalFilter,
      startTime: { lte: now },
      endTime: { gte: now },
      promotionStatus: "ACTIVE",
    };
  } else if (status === "history") {
    additionalFilter = {
      ...additionalFilter,
      endTime: { lt: now },
      promotionStatus: "ACTIVE",
    };
  }
  const promotion = searchAndPaginate<
    typeof prisma.promotion,
    Prisma.promotionWhereInput,
    Prisma.promotionSelect
  >(
    prisma.promotion,
    [],
    Number(page) || 1,
    Number(limit) || 10,
    "",
    additionalFilter,
    {
      select: {
        id: true,
        caption: true,
        startTime: true,
        endTime: true,
        value: true,

        facility: {
          select: {
            facilityName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        promotionImage: true,
        promotionType: true,
      },
    },
  );

  return promotion;
};

const getSinglePromotion = async (promotionId: string) => {
  const promotion = await prisma.promotion.findUnique({
    where: {
      id: promotionId,
    },
    select: {
      id: true,

      caption: true,
      startTime: true,
      endTime: true,
      value: true,

      facility: {
        select: {
          facilityName: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      promotionImage: true,
      promotionType: true,
      createdAt: true,
    },
  });
  return promotion;
};

const updateSinglePromotion = async (payload: any) => {
  const promotion = await prisma.promotion.findUnique({
    where: {
      id: payload.promotionId,
    },
    include: {
      facility: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!promotion) {
    throw new ApiError(httpStatus.NOT_FOUND, "promotion not found");
  }
  if (promotion.facility.userId !== payload.facilityId) {
    throw new ApiError(
      httpStatus.NOT_ACCEPTABLE,
      "you are not the owner of this promotion",
    );
  }
  await stripe.paymentMethods.attach(payload.paymentMethodId, {
    customer: payload.stripeCustomerId,
  });
  await stripe.customers.update(payload.stripeCustomerId, {
    invoice_settings: { default_payment_method: payload.paymentMethodId },
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Number(payload.value || promotion.value) * 100,
    currency: "usd",
    customer: payload.stripeCustomerId,
    payment_method: payload.paymentMethodId,
    confirm: true,

    automatic_payment_methods: {
      enabled: true,
      allow_redirects: "never",
    },
  });
  if (paymentIntent.status === "succeeded") {
    const result = await prisma.promotion.update({
      where: {
        id: payload.promotionId,
      },
      data: {
        caption: payload.caption || promotion.caption,
        endTime: payload.endTime || promotion.endTime,
        promotionImage: payload.promotionImage || promotion.promotionImage,
        promotionType: payload.promotionType || promotion.promotionType,
        startTime: payload.startTime || promotion.startTime,

        value: payload.value || promotion.value,
        promotionStatus: "ACTIVE",
      },
    });
    await prisma.communityPost.create({
      data: {
        type: "PROMOTION",
        imageUrl: promotion.promotionImage,
        promotionId: promotion.id,
      },
    });
    return result;
  }
};

export const promotionService = {
  createPromotion,
  updatePromotionStatus,
  getPromotion,
  getPromotionByFacility,
  getSinglePromotion,
  updateSinglePromotion,
};
