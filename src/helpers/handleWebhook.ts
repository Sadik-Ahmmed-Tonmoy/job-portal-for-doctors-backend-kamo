import Stripe from "stripe";
import config from "../config";
import catchAsync from "../shared/catchAsync";
import sendResponse from "../shared/sendResponse";
import prisma from "../shared/prisma";
import { ConnectionCheckOutStartedEvent } from "mongodb";

const stripe = new Stripe(config.stripe.secretKey as string);

const handleWebHook = catchAsync(async (req: any, res: any) => {
  console.log("hit");
  const sig = req.headers["stripe-signature"] as string;
  console.log("sig", sig);
  if (!sig) {
    return sendResponse(res, {
      statusCode: 400,
      success: false,
      message: "Missing Stripe signature header.",
      data: null,
    });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret as string
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return res.status(400).send("Webhook Error: Invalid signature.");
  }
  switch (event.type) {
    case "account.updated":
      break;
    case "account.application.authorized":
      break;
    case "account.external_account.created":
      break;
    case "invoice.created":
      const createdInvoice = event.data.object as Stripe.Invoice;
      console.log(createdInvoice, "check create invoice ");
      const createdInvoiceMetadata = createdInvoice.metadata;
      const createdSubscriptionId =
        createdInvoiceMetadata?.subscriptionId as string;
      const createdPriceId = createdInvoiceMetadata?.priceId;
      const ownerId = createdInvoiceMetadata?.userId;
      const invoiceId = createdInvoice?.id as string;
      const createdAmount = createdInvoice?.amount_paid;

      break;
    case "invoice.payment_succeeded":
      const invoice = event.data.object as Stripe.Invoice;
      console.log(invoice, "check from  pyament succeed");
      const paymentSucceededMetadata = invoice.lines?.data?.[0]?.metadata || {};
      const priceId = paymentSucceededMetadata?.priceId as string;
      const subscriptionId = paymentSucceededMetadata?.subscriptionId as string;
      const userId = paymentSucceededMetadata?.userId as string;
      const succeededMemberId = paymentSucceededMetadata?.memberId as string;
      const isFamilyPlan = paymentSucceededMetadata?.isFamilyPlan as string;
      const subscriptionPayId = invoice?.id as string;
      const amount = invoice?.amount_paid;

      break;
    case "invoice.payment_failed":
      const failedInvoice = event.data.object as Stripe.Invoice;
      console.log(failedInvoice, "check failed invoice");
      const failedMetadata = failedInvoice.lines?.data?.[0]?.metadata || {};
      const failedPriceId = failedMetadata?.priceId as string;
      const failedUserId = failedMetadata?.userId as string;
      const failedMemberId = failedMetadata?.memberId as string;
      const adminInvoiceId = failedMetadata?.adminInvoiceId as string;
      const failedIsFamilyPlan = failedMetadata?.isFamilyPlan as string;
      const failedSubscriptionPayId = failedInvoice?.id as string;
      const faliedAmount = failedInvoice?.amount_paid;

      break;
    case "customer.subscription.created":
      const customerSubscription = event.data.object;
      console.log(customerSubscription, "check customer subscription");
      break;
    case "customer.subscription.updated":
      const updatedCustomerSubscription = event.data.object;
      console.log(
        updatedCustomerSubscription,
        "check customer update subscription"
      );
      break;
    case "customer.subscription.deleted":
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionMetadata = subscription?.metadata || {};
      const deletedPriceId = subscriptionMetadata?.priceId as string;
      const deletedUserId = subscriptionMetadata?.userId as string;
      const deletedMemberId = subscriptionMetadata?.memberId as string;
      const deletedIsFamilyPlan = subscriptionMetadata?.isFamilyPlan as string;
      const deleteAdminInvoiceId =
        subscriptionMetadata?.adminInvoiceId as string;
      const deletedSubscriptionPayId = subscriptionMetadata?.id as string;

      break;

    // One-Time Payments
    case "checkout.session.completed":
      break;
    case "charge.succeeded":
      break;
    case "charge.failed":
      break;

    //  Refunds
    case "charge.refunded":
    case "charge.refund.updated":
      break;

    // Other Events
    case "capability.updated":
      break;
    case "financial_connections.account.created":
      break;
    case "customer.created":
      break;
    case "transfer.created":
      break;
    case "product.created":
    case "plan.created":
    case "price.created":
    case "payment_method.attached":
    case "customer.updated":
    case "payment_intent.succeeded":
    case "payment_intent.created":
    case "invoice.finalized":
    case "invoice.created":
    case "invoice.paid":
    case "payout.paid":
    case "balance.available":
    case "payout.updated":
    case "payout.created":
    case "coupon.created":
    case "customer.discount.created":
    case "customer.discount.deleted":
    case "setup_intent.created":
    case "setup_intent.succeeded":
    case "setup_intent.canceled":
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send("Event received");
});

export default handleWebHook;
