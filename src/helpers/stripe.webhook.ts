import Stripe from "stripe";
import config from "../config";
import catchAsync from "../shared/catchAsync";
import sendResponse from "../shared/sendResponse";
import prisma from "../shared/prisma";
import { ConnectionCheckOutStartedEvent } from "mongodb";
import { subscriptionService } from "../app/modules/subscription/subscription.service";

const stripe = new Stripe(config.stripe.secretKey as string);

const handleWebHook = catchAsync(async (req: any, res: any) => {

  const sig = req.headers["stripe-signature"] as string;

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
      // console.log(createdInvoice, "check create invoice ");

      break;
    case "invoice.payment_succeeded":
      const invoice = event.data.object as Stripe.Invoice;
      await subscriptionService.handleSubscriptionSucceed(invoice);

      break;
    case "invoice.payment_failed":
      const failedInvoice = event.data.object as Stripe.Invoice;
      await subscriptionService.failedCustomerSubscription(failedInvoice);

      break;
    case "customer.subscription.created":
      const customerSubscription = event.data.object;

      await subscriptionService.handleSubscriptionCreated(customerSubscription);

      break;
    case "customer.subscription.updated":
      const updatedCustomerSubscription = event.data.object;
      await subscriptionService.updateCustomerSubscription(
        updatedCustomerSubscription
      );
      break;
    case "customer.subscription.deleted":
      const deleteSubscription=event.data.object;
      await subscriptionService.handleSubscriptionCancel(deleteSubscription)
      break;

    case "checkout.session.completed":
      break;
    case "charge.succeeded":
      break;
    case "charge.failed":
      break;

    case "charge.refunded":
    case "charge.refund.updated":
      break;

    case "capability.updated":
      break;
    case "financial_connections.account.created":
      break;
    case "customer.created":
      break;
    case "transfer.created":
      break;
    case "product.created":
      break;
    case "plan.created":
      break;
    case "price.created":
      break;
    case "payment_method.attached":
      break;
    case "customer.updated":
      break;
    case "payment_intent.succeeded":
      break;
    case "payment_intent.created":
      break;
    case "invoice.finalized":
      break;
    case "invoice.created":
      break;
    case "invoice.paid":
      break;
 
    case "payout.paid":
      break;
    case "balance.available":
      break;
    case "payout.updated":
      break;
    case "payout.created":
      break;
    case "coupon.created":
      break;
    case "customer.discount.created":
      break;
    case "customer.discount.deleted":
      break;
    case "setup_intent.created":
      break;
    case "setup_intent.succeeded":
      break;
    case "setup_intent.canceled":
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send("Event received");
});

export default handleWebHook;
