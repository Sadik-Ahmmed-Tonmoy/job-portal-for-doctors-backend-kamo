import cron from "node-cron";
import prisma from "../shared/prisma";
import { userService } from "../app/modules/user/user.service";
//"0 */12 * * *
//*/1 * * * *
export const runCronJob = () => {
  cron.schedule("0 */12 * * *", async () => {
    try {
      const [freePlanForFacility, freePlanForProvider] = await Promise.all([
        prisma.subscription.findFirstOrThrow({
          where: { title: "FREE", role: "FACILITY" },
          include: { subscriptionFeatures: true },
        }),
        prisma.subscription.findFirstOrThrow({
          where: { title: "FREE", role: "PROVIDER" },
          include: { subscriptionFeatures: true },
        }),
      ]);

      const freePlanIds = [freePlanForFacility.id, freePlanForProvider.id];

      const expiredTrials = await prisma.userSubscription.findMany({
        where: {
          OR: [
            { subscriptionPayId: null },
            { subscriptionPayId: { isSet: false } },
          ],
          subscriptionId: { notIn: freePlanIds },
          updatedAt: {
            lt: new Date(),
          },
          status: "ACTIVE",
        },
        select: {
          id: true,
          userId: true,
          user: { select: { role: true } },
        },
      });

      console.log(`Found ${expiredTrials.length} expired trials`);

      if (!expiredTrials.length) return;

      const facilityTrials = expiredTrials.filter(
        (sub) => sub.user?.role === "FACILITY",
      );
      const providerTrials = expiredTrials.filter(
        (sub) => sub.user?.role !== "FACILITY",
      );

      const facilityIds = facilityTrials.map((sub) => sub.id);
      const providerIds = providerTrials.map((sub) => sub.id);

      const facilityUserIds = facilityTrials
        .map((sub) => sub.userId)
        .filter((id): id is string => id !== null);

      const providerUserIds = providerTrials
        .map((sub) => sub.userId)
        .filter((id): id is string => id !== null);

      const allUserIds = [...facilityUserIds, ...providerUserIds];
      console.log("Facility trials:", facilityTrials.length);
      console.log("Provider trials:", providerTrials.length);
      console.log("Facility IDs to update:", facilityIds);
      console.log("Provider IDs to update:", providerIds);
      await prisma.$transaction(
        async (tx) => {
          if (facilityIds.length) {
            await tx.userSubscription.updateMany({
              where: { id: { in: facilityIds } },
              data: {
                subscriptionId: freePlanForFacility.id,
                status: "ACTIVE",
              },
            });
          }

          if (providerIds.length) {
            await tx.userSubscription.updateMany({
              where: { id: { in: providerIds } },
              data: {
                subscriptionId: freePlanForProvider.id,
                status: "ACTIVE",
              },
            });
          }

          await tx.trackUserFeatureUsage.deleteMany({
            where: { userId: { in: allUserIds } },
          });

          const facilityFeatureData = facilityUserIds.flatMap((userId) =>
            freePlanForFacility.subscriptionFeatures.map((sub: any) => ({
              userId,
              feature: sub.feature,
              featureType: sub.featureType,
              limit: sub.limit,
              expiredAt: userService.calculateExpiredAt(sub.frequency),
              isGlobal: sub.isGlobal,
              isActive: true,
              enabled: sub.enabled,
            })),
          );

          const providerFeatureData = providerUserIds.flatMap((userId) =>
            freePlanForProvider.subscriptionFeatures.map((sub: any) => ({
              userId,
              feature: sub.feature,
              featureType: sub.featureType,
              limit: sub.limit,
              expiredAt: userService.calculateExpiredAt(sub.frequency),
              isGlobal: sub.isGlobal,
              isActive: true,
              enabled: sub.enabled,
            })),
          );

          await tx.trackUserFeatureUsage.createMany({
            data: [...facilityFeatureData, ...providerFeatureData],
          });
        },
        {
          timeout: 30000,
          maxWait: 20000,
        },
      );

      console.log(
        `✅ Downgraded ${allUserIds.length} users to free plan successfully.`,
      );
    } catch (error) {
      console.error("❌ Cron job failed:", error);
    }
  });

  console.log(
    "🕒 Subscription expiry cron job scheduled to run every 12 hours.",
  );
};
