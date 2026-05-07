import Stripe from "stripe";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import prisma from "../../../shared/prisma";
import {
  PaymentStatus,
  SubscriptionStatus,
  SubscriptionType,
} from "@prisma/client";
import { generateUniqueTransactionId } from "../../../utlits/transactionIdGenerator";
import { userService } from "../user/user.service";

const stripe = new Stripe(config.stripe.secretKey as string);
// const createSubscriptionIntoDb = async (payload: any) => {
//   let product: Stripe.Product | null = null;
//   // let prices: Stripe.Price | null = null;
//   let price: any;
//   if (payload.title !== SubscriptionType.FREE) {
//     product = await stripe.products.create({
//       name: payload.title,

//       default_price_data: {
//         currency: "usd",
//         unit_amount: Math.round(parseFloat(payload.price) * 100),
//         recurring: {
//           interval: payload.interval,
//           interval_count: payload.interval_count,
//         },
//       },
//       expand: ["default_price"],
//     });
//     if (!product) {
//       throw new ApiError(httpStatus.BAD_REQUEST, "product not crated");
//     }

//     price = product.default_price as Stripe.Price;
//   }

//   const subsription = await prisma.subscription.create({
//     data: {
//       features: payload.features,
//       price: payload.price as number,
//       productId: payload.title === SubscriptionType.FREE ? null : product?.id,
//       pricingId: payload.title === SubscriptionType.FREE ? null : price.id,
//       interval: payload.interval,
//       interval_count: payload.interval_count,
//       title: payload.title,
//     },
//   });
//   return subsription;
// };
const createSubscriptionIntoDb = async (payload: any) => {
  let product: Stripe.Product | null = null;
  let price: Stripe.Price | null = null;
  let stripeCouponId: string | null = null;

  if (payload.title !== SubscriptionType.FREE) {
    product = await stripe.products.create({
      name: payload.title,
      default_price_data: {
        currency: "gbp",
        unit_amount: Math.round(parseFloat(payload.price) * 100),
        recurring: {
          interval: payload.interval,
          interval_count: payload.interval_count,
        },
      },
      expand: ["default_price"],
    });

    if (!product) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Product not created");
    }

    price = product.default_price as Stripe.Price;
  }

  const tr = await prisma.$transaction(async (tr) => {
    const subscription = await tr.subscription.create({
      data: {
        role: payload.role,

        features: payload.features,
        price: payload.price as number,
        productId: payload.title === SubscriptionType.FREE ? null : product?.id,
        pricingId: payload.title === SubscriptionType.FREE ? null : price?.id,
        interval: payload.interval,
        interval_count: payload.interval_count,
        title: payload.title,
      },
    });

    await tr.subscriptionFeature.createMany({
      data: payload.subscriptionFeatures.map((feature: any) => ({
        subscriptionId: subscription.id,
        feature: feature.feature,
        featureType: feature.featureType,
        title: feature.title,
        limit: feature.limit ?? null,
        frequency: feature.frequency ?? null,
        enabled:
          feature.featureType === "BOOLEAN" ? (feature.enabled ?? false) : true,
        extraValue: feature.extraValue ?? null,
        isGlobal: feature.isGlobal ?? false,
      })),
    });

    return subscription;
  });

  return tr;
};
const getAllSubscriptionPlans = async (role: any) => {
  console.log(role, "chekc role");
  const subscription = await prisma.subscription.findMany({
    where: {
      role: role,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return subscription;
};

/** Get the FREE subscription plan (no Stripe price). Used for downgrades and free plan selection. */
const getFreeSubscriptionPlan = async () => {
  const freePlan = await prisma.subscription.findFirst({
    where: { title: SubscriptionType.FREE },
    include: { subscriptionFeatures: true },
  });
  if (!freePlan) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Free subscription plan not configured in database",
    );
  }
  return freePlan;
};

/**
 * Downgrade user to free plan: set paid sub DEACTIVE, create/activate free UserSubscription,
 * apply free plan features to TrackUserFeatureUsage. Use after payment failure or subscription cancel.
 */
const downgradeUserToFreePlan = async (userId: string) => {
  const freePlan = await getFreeSubscriptionPlan();
  await prisma.$transaction(
    async (tx) => {
      await tx.userSubscription.updateMany({
        where: { userId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.DEACTIVE },
      });
      await tx.userSubscription.upsert({
        where: {
          userId_subscriptionId: {
            userId,
            subscriptionId: freePlan.id,
          },
        },
        update: {
          status: SubscriptionStatus.ACTIVE,
          priceId: null,
          subscriptionPayId: null,
        },
        create: {
          userId,
          subscriptionId: freePlan.id,
          priceId: null,
          subscriptionPayId: null,
          status: SubscriptionStatus.ACTIVE,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isSubscription: true },
      });
      await userService.featuredAddforSubscribedUser(
        tx,
        freePlan.subscriptionFeatures,
        userId,
      );
    },
    { timeout: 15000 },
  );
};

const purchaseSubscription = async (
  payload: any,
  userId: string,
  email: string,
  fullName: string,
  stripeCustomerId?: string,
) => {
  const subscriptionPlan = await prisma.subscription.findUnique({
    where: { id: payload.subscriptionId },
    include: { subscriptionFeatures: true },
  });

  if (!subscriptionPlan) {
    throw new ApiError(httpStatus.NOT_FOUND, "Subscription plan not found");
  }

  const existingActiveSub = await prisma.userSubscription.findFirst({
    where: { userId, status: SubscriptionStatus.ACTIVE },
  });

  // Free plan: no Stripe, no payment. Just set free plan and track features.
  if (subscriptionPlan.title === SubscriptionType.FREE) {
    const freeSub = await prisma.$transaction(
      async (tx) => {
        if (existingActiveSub) {
          await tx.userSubscription.delete({
            where: { id: existingActiveSub.id },
          });
        }
        const sub = await tx.userSubscription.upsert({
          where: {
            userId_subscriptionId: {
              userId,
              subscriptionId: subscriptionPlan.id,
            },
          },
          update: {
            status: SubscriptionStatus.ACTIVE,
            priceId: null,
            subscriptionPayId: null,
          },
          create: {
            userId,
            subscriptionId: subscriptionPlan.id,
            priceId: null,
            subscriptionPayId: null,
            status: SubscriptionStatus.ACTIVE,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { isSubscription: true },
        });
        await userService.featuredAddforSubscribedUser(
          tx,
          subscriptionPlan.subscriptionFeatures,
          userId,
        );
        return sub;
      },
      { timeout: 15000 },
    );
    return {
      clientSecret: null,
      subscription: freeSub,
      stripeSubscriptionId: null,
    };
  }

  // Paid plan: require payment method and Stripe
  if (!payload.paymentMethodId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Payment method is required for paid plans",
    );
  }

  const transactionId = await generateUniqueTransactionId();

  // For paid plan, remove current active subscription before creating/updating Stripe subscription
  if (existingActiveSub) {
    await prisma.userSubscription.delete({
      where: { id: existingActiveSub.id },
    });
  }

  //if stripe customer not create then we create a customer for that user in stripe
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ email, name: fullName });
    stripeCustomerId = customer.id;
  }

  await stripe.paymentMethods.attach(payload.paymentMethodId, {
    customer: stripeCustomerId,
  });
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: payload.paymentMethodId },
  });

  if (!subscriptionPlan.pricingId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Paid plan is missing Stripe priceId",
    );
  }

  const existingStripeSubs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
  });

  const existingStripe = existingStripeSubs.data[0];

  let stripeSub: Stripe.Subscription | undefined;
  let dbUserSubscription;
  let paymentIntent: Stripe.PaymentIntent | undefined;

  try {
    if (existingStripe) {
      stripeSub = await stripe.subscriptions.update(existingStripe.id, {
        items: [
          {
            id: existingStripe.items.data[0].id,
            price: subscriptionPlan.pricingId,
          },
        ],
        metadata: {
          priceId: subscriptionPlan.pricingId,
          subscriptionId: subscriptionPlan.id,
          userId,
        },
        proration_behavior: "create_prorations",
        expand: ["latest_invoice.payment_intent"],
        payment_behavior: "allow_incomplete",
      });
    } else {
      stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: subscriptionPlan.pricingId }],
        payment_behavior: "allow_incomplete",
        payment_settings: {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          priceId: subscriptionPlan.pricingId,
          subscriptionId: subscriptionPlan.id,
          userId,
        },
      });
    }

    const latestInvoiceRaw = stripeSub.latest_invoice;
    if (!latestInvoiceRaw) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Stripe did not return an invoice",
      );
    }

    // Resolve invoice object
    let invoice: Stripe.Invoice;
    if (typeof latestInvoiceRaw === "string") {
      invoice = await stripe.invoices.retrieve(latestInvoiceRaw);
    } else {
      invoice = latestInvoiceRaw;
    }

    if (!invoice.payment_intent || typeof invoice.payment_intent === "string") {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Payment intent not available in invoice",
      );
    }

    paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    dbUserSubscription = await prisma.$transaction(
      async (tx) => {
        const subscription = await tx.userSubscription.upsert({
          where: {
            userId_subscriptionId: {
              userId,
              subscriptionId: subscriptionPlan.id,
            },
          },
          update: {
            subscriptionPayId: stripeSub!.id,
            priceId: subscriptionPlan.pricingId,
            status: SubscriptionStatus.ACTIVE,
          },
          create: {
            userId,
            subscriptionId: subscriptionPlan.id,
            priceId: subscriptionPlan.pricingId,
            subscriptionPayId: stripeSub!.id,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        await tx.payment.create({
          data: {
            userId,
            subscriptionId: subscriptionPlan.id,
            stripePaymentIntentId: paymentIntent!.id,
            amount: paymentIntent!.amount / 100,
            PaymentStatus: PaymentStatus.ACTIVE,
            paymentType: "SUBSCRIPITON",
            transactionId,
            paymentIntentId: paymentIntent!.id,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { isSubscription: true },
        });

        await userService.featuredAddforSubscribedUser(
          tx,
          subscriptionPlan.subscriptionFeatures,
          userId,
        );

        return subscription;
      },
      {
        timeout: 20000,
        maxWait: 7000,
      },
    );

    if (paymentIntent.status === "requires_capture") {
      await stripe.paymentIntents.capture(paymentIntent.id);
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { PaymentStatus: PaymentStatus.ACTIVE },
      });
    }

    // if (
    //   paymentIntent.status === "requires_payment_method" ||
    //   paymentIntent.status === "requires_confirmation"
    // ) {
    //   const confirmedPayment = await stripe.paymentIntents.confirm(
    //     paymentIntent.id,
    //     { payment_method: payload.paymentMethodId }
    //   );
    //   paymentIntent = confirmedPayment;
    //   await prisma.payment.updateMany({
    //     where: { stripePaymentIntentId: paymentIntent.id },
    //     data: { PaymentStatus: PaymentStatus.ACTIVE },
    //   });
    // }
  } catch (dbError: any) {
    if (paymentIntent && paymentIntent.status === "succeeded") {
      await stripe.refunds.create({ payment_intent: paymentIntent.id });
    }

    if (!existingStripe && stripeSub) {
      await stripe.subscriptions.cancel(stripeSub.id);
    } else if (existingStripe) {
      await stripe.subscriptions.update(existingStripe.id, {
        items: [
          {
            id: existingStripe.items.data[0].id,
            price: existingStripe.items.data[0].price.id,
          },
        ],
        proration_behavior: "none",
      });
    }

    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, dbError);
  }

  return {
    clientSecret: paymentIntent?.client_secret,
    subscription: dbUserSubscription,
    stripeSubscriptionId: stripeSub!.id,
  };
};
/**
 * Plan changed in Stripe (customer.subscription.updated). Sync priceId/subscriptionId
 * and re-apply features for the new plan (upgrade/downgrade).
 */
const updateCustomerSubscription = async (payload: Stripe.Subscription) => {
  const currentSub = await prisma.userSubscription.findFirst({
    where: { subscriptionPayId: payload.id },
  });
  if (!currentSub?.userId) return;

  const newPriceId = payload.items?.data?.[0]?.price?.id;
  const newSubscriptionId = payload.metadata?.subscriptionId;
  if (!newPriceId) return;

  if (
    currentSub.priceId !== newPriceId ||
    (newSubscriptionId && currentSub.subscriptionId !== newSubscriptionId)
  ) {
    const subscriptionId = newSubscriptionId || currentSub.subscriptionId;
    await prisma.userSubscription.update({
      where: { id: currentSub.id },
      data: {
        priceId: newPriceId,
        ...(subscriptionId && { subscriptionId }),
      },
    });
    const plan = await prisma.subscription.findUnique({
      where: { id: subscriptionId! },
      include: { subscriptionFeatures: true },
    });
    if (plan?.subscriptionFeatures?.length) {
      await prisma.$transaction(async (tx) => {
        await userService.featuredAddforSubscribedUser(
          tx,
          plan.subscriptionFeatures,
          currentSub.userId!,
        );
      });
    }
  }
};

/**
 * Recurring payment succeeded (invoice.payment_succeeded). Keep subscription ACTIVE,
 * sync priceId, and re-apply plan features (e.g. after recovery from a previous payment_failed).
 */
const handleSubscriptionSucceed = async (payload: Stripe.Invoice) => {
  const stripeSubId =
    typeof payload.subscription === "string"
      ? payload.subscription
      : payload.subscription?.id;
  if (!stripeSubId || !payload.lines?.data?.length) return;

  const priceId = payload.lines.data[0].price?.id;
  const userSub = await prisma.userSubscription.findFirst({
    where: { subscriptionPayId: stripeSubId },
    include: {
      subscription: { include: { subscriptionFeatures: true } },
    },
  });
  if (!userSub?.userId) return;

  await prisma.userSubscription.update({
    where: { id: userSub.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      ...(priceId && { priceId }),
    },
  });
  if (userSub.subscription?.subscriptionFeatures?.length) {
    await prisma.$transaction(async (tx) => {
      await userService.featuredAddforSubscribedUser(
        tx,
        userSub.subscription!.subscriptionFeatures,
        userSub.userId!,
      );
    });
  }
};

/**
 * Recurring payment failed (invoice.payment_failed). Deactivate paid subscription
 * and downgrade user to free plan so features are limited to free tier.
 */
const failedCustomerSubscription = async (payload: Stripe.Invoice) => {
  const stripeSubId =
    typeof payload.subscription === "string"
      ? payload.subscription
      : payload.subscription?.id;
  if (!stripeSubId) return;

  const userSub = await prisma.userSubscription.findFirst({
    where: { subscriptionPayId: stripeSubId },
  });
  if (!userSub?.userId) return;

  await prisma.userSubscription.update({
    where: { id: userSub.id },
    data: { status: SubscriptionStatus.DEACTIVE },
  });
  await downgradeUserToFreePlan(userSub.userId);
};

/**
 * Stripe subscription created (customer.subscription.created). Sync our DB if we
 * created it (idempotent); ignore if subscription has no metadata (e.g. created in Stripe dashboard).
 */
const handleSubscriptionCreated = async (payload: Stripe.Subscription) => {
  const userId = payload.metadata?.userId;
  const subscriptionId = payload.metadata?.subscriptionId;
  const priceId = payload.items?.data?.[0]?.price?.id;
  if (!userId || !subscriptionId || !priceId) return;

  const userSub = await prisma.userSubscription.findFirst({
    where: { subscriptionPayId: payload.id },
  });

  if (userSub) {
    await prisma.userSubscription.update({
      where: { id: userSub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        priceId,
      },
    });
  } else {
    await prisma.userSubscription.create({
      data: {
        userId,
        subscriptionId,
        subscriptionPayId: payload.id,
        priceId,
        status: SubscriptionStatus.ACTIVE,
      },
    });
  }
};

const cancelSubscription = async (subscriptionId: any, userId: string) => {
  const userSubscription = await prisma.userSubscription.findUnique({
    where: {
      userId_subscriptionId: {
        userId,
        subscriptionId,
      },
    },
  });

  if (!userSubscription || !userSubscription.subscriptionPayId) {
    throw new Error("User subscription not found");
  }

  const stripeCancel = await stripe.subscriptions.update(
    userSubscription?.subscriptionPayId,
    {
      cancel_at_period_end: true,
    },
  );

  await prisma.userSubscription.update({
    where: { id: userSubscription.id },
    data: { status: SubscriptionStatus.DEACTIVE },
  });

  await downgradeUserToFreePlan(userId);

  return stripeCancel;
};

/**
 * Stripe subscription deleted (customer.subscription.deleted). Deactivate paid sub
 * and downgrade user to free plan so they keep free tier access.
 */
const handleSubscriptionCancel = async (payload: Stripe.Subscription) => {
  const stripeSubId = payload.id;
  const userSub = await prisma.userSubscription.findFirst({
    where: { subscriptionPayId: stripeSubId },
  });

  if (!userSub) {
    console.warn("Subscription not found in DB:", stripeSubId);
    return;
  }

  const userId = userSub.userId;
  await prisma.userSubscription.update({
    where: { id: userSub.id },
    data: { status: SubscriptionStatus.DEACTIVE },
  });

  if (userId) {
    await downgradeUserToFreePlan(userId);
  }
};

export const subscriptionService = {
  createSubscriptionIntoDb,
  getAllSubscriptionPlans,
  purchaseSubscription,
  handleSubscriptionCreated,
  updateCustomerSubscription,
  handleSubscriptionSucceed,
  failedCustomerSubscription,
  cancelSubscription,
  handleSubscriptionCancel,
};
