import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { PLAN_DURATION_DAYS } from "../config/pricing";
import { Payment } from "../models/payment.model";
import { IUser, User } from "../models/User";
import { PlanType } from "../types/payment";

type MobileBankingType = "bKash" | "nagad" | "rocket";

const VALID_PLANS: PlanType[] = [
  "monthly",
  "six_month",
  "yearly",
  "subject_yearly",
];

const VALID_PAYMENT_METHODS: MobileBankingType[] = ["bKash", "nagad", "rocket"];

/**
 * POST /payments
 * Record a new payment
 */
export const recordPayment = async (req: Request, res: Response) => {
  try {
    const {
      plan,
      amount,
      paymentMethod,
      transactionId,
      phoneNumber,
      selectedSubjects,
    } = req.body;

    // User ID should come from authenticated user, not request body
    const authUser = (req as any).user;
    const userId = authUser?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({
        message: "Invalid payment plan",
      });
    }

    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    if (!transactionId?.trim() && !phoneNumber?.trim()) {
      return res.status(400).json({
        message: "Transaction ID or phone number is required",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount",
      });
    }

    if ((plan as PlanType) === "subject_yearly") {
      if (
        !selectedSubjects ||
        !Array.isArray(selectedSubjects) ||
        selectedSubjects.length === 0
      ) {
        return res.status(400).json({
          message: "অন্তত বিষয় সিলেক্ট করুন",
        });
      }
    }

    const durationDays = PLAN_DURATION_DAYS[plan as PlanType];

    const payment = await Payment.create({
      userId,
      email: authUser.email,
      name: authUser.name,
      plan,
      selectedSubjects,
      durationDays,
      amount,
      currency: "BDT",
      paymentMethod,
      transactionId: transactionId?.trim(),
      phoneNumber: phoneNumber?.trim(),
      paymentStatus: "pending",
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error("Record payment error:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: "Invalid payment data",
        errors: error.errors,
      });
    }

    return res.status(500).json({
      message: "Failed to record payment",
    });
  }
};

/**
 * GET /payments/history
 * Get authenticated user's payment history
 */
export const getUserPaymentHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const payments = await Payment.find({ userId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(payments);
  } catch (error) {
    console.error("Get payment history error:", error);

    return res.status(500).json({
      message: "Failed to get payment history",
    });
  }
};

/**
 * GET /payments/all
 * Admin: get all payments
 */

export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const paymentStatus = req.query.paymentStatus as string | undefined;
    const phoneNumberSearch =
      (req.query.phoneNumberSearch as string | undefined)?.trim() || "";

    const transactionIdSearch =
      (req.query.transactionIdSearch as string | undefined)?.trim() || "";

    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    // Payment status
    if (paymentStatus && paymentStatus !== "all") {
      filter.paymentStatus = paymentStatus;
    }

    // Phone number search
    if (phoneNumberSearch) {
      filter.phoneNumber = {
        $regex: phoneNumberSearch,
        $options: "i",
      };
    }

    // Transaction ID search
    if (transactionIdSearch) {
      filter.transactionId = {
        $regex: transactionIdSearch,
        $options: "i",
      };
    }

    const [items, totalItems] = await Promise.all([
      Payment.find({ ...filter, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email")
        .populate({
          path: "selectedSubjects.subjectId",
          select: "name class",
          populate: {
            path: "class",
            select: "name",
          },
        })
        .lean(),

      Payment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return res.status(200).json({
      items,
      totalItems,
      currentPage: page,
      totalPages,
      nextPage: page < totalPages ? page + 1 : null,
      limit,
    });
  } catch (error) {
    console.error("getAllPayments error:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    const { paymentId } = req.params;
    const { status, message } = req.body as {
      status: "verified" | "rejected";
      message?: string;
    };

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid payment status." });
    }

    if (status === "rejected" && !message?.trim()) {
      return res.status(400).json({
        message: "A reason is required for rejected payments.",
      });
    }

    let result: { status: number; body: any } | undefined;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);

      if (!payment) {
        result = { status: 404, body: { message: "Payment not found." } };
        return;
      }

      // Don't allow processing an already-processed payment.
      if (payment.paymentStatus !== "pending") {
        result = {
          status: 400,
          body: {
            message: `This payment has already been ${payment.paymentStatus}.`,
          },
        };
        return;
      }

      // --------------------------------
      // VERIFIED
      // --------------------------------
      if (status === "verified") {
        const now = new Date();

        const user = (await User.findOne({ _id: payment.userId }).session(
          session,
        )) as IUser | null;

        if (!user) {
          result = {
            status: 404,
            body: {
              message: "User associated with this payment was not found.",
            },
          };
          return;
        }

        const paymentPlan = payment.plan as PlanType;

        const durationDays = payment.durationDays;

        if (!durationDays) {
          result = {
            status: 400,
            body: { message: "Invalid subscription plan." },
          };
          return;
        }
        if (paymentPlan === "subject_yearly") {
          const selectedSubjects = payment.selectedSubjects;

          if (!selectedSubjects || selectedSubjects.length === 0) {
            result = {
              status: 400,
              body: {
                message: "No subjects found for this payment.",
              },
            };
            return;
          }

          const subjectSubscriptions = user.subjectWiseSubscription ?? [];

          for (const selectedSubject of selectedSubjects) {
            const existingSubscription = subjectSubscriptions.find(
              (subscription) =>
                subscription.subjectId.equals(selectedSubject.subjectId),
            );

            if (existingSubscription) {
              const currentEnd = new Date(existingSubscription.expiresAt);

              // If active, extend from existing expiry.
              // If expired, start again from now.
              const subscriptionStart = currentEnd > now ? currentEnd : now;

              const subscriptionEnd = new Date(subscriptionStart);
              subscriptionEnd.setDate(subscriptionEnd.getDate() + durationDays);

              // Keep the original startedAt when renewing.
              existingSubscription.expiresAt = subscriptionEnd;
            } else {
              const subscriptionEnd = new Date(now);
              subscriptionEnd.setDate(subscriptionEnd.getDate() + durationDays);

              subjectSubscriptions.push({
                subjectId: selectedSubject.subjectId,
                startedAt: now,
                expiresAt: subscriptionEnd,
              });
            }
          }

          user.subjectWiseSubscription = subjectSubscriptions;
        } else {
          const currentEnd = user.subscription?.expiresAt
            ? new Date(user.subscription?.expiresAt)
            : null;
          const subscriptionStart =
            currentEnd && currentEnd > now ? new Date(currentEnd) : now;

          const subscriptionEnd = new Date(subscriptionStart);
          subscriptionEnd.setDate(subscriptionEnd.getDate() + durationDays);

          user.subscription = {
            startedAt: subscriptionStart,
            expiresAt: subscriptionEnd,
          };
        }

        await user.save({ session });

        payment.paymentStatus = "verified";
        payment.statusMessage = undefined;

        await payment.save({ session });

        result = {
          status: 200,
          body: { message: "Payment verified successfully.", payment, user },
        };
        return;
      }

      // --------------------------------
      // REJECTED / INVALID
      // --------------------------------
      payment.paymentStatus = status;
      payment.statusMessage = message?.trim();

      await payment.save({ session });

      result = {
        status: 200,
        body: {
          message:
            status === "rejected"
              ? "Payment rejected successfully."
              : "Payment marked as invalid successfully.",
          payment,
        },
      };
    });

    return res.status(result!.status).json(result!.body);
  } catch (error) {
    console.error("updatePaymentStatus error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    await session.endSession();
  }
};

export const updatePaymentInfo = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const updateData = req.body;

    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId },
      updateData,
      {
        new: true,
      },
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.status(200).json(payment);
  } catch (error) {
    console.error("updatePaymentInfo error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deletePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findByIdAndUpdate(
      paymentId,
      { isDeleted: true },
      { new: true },
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.status(200).json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("deletePayment error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/** GET /payments/sales-summary — verified, non-deleted BDT payments only. */

const PAYMENT_METHODS = ["bKash", "nagad", "rocket"] as const;
const PLANS = [
  "monthly",
  "six_month",
  "yearly",
  "subject_yearly",
  "custom",
] as const;

type QueryValue = string | string[] | undefined;

function readQueryString(value: QueryValue): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ${field} date`);
  return date;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthKeys(from: Date, to: Date): string[] {
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  const months: string[] = [];
  while (cursor <= last) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
export async function getPaymentSalesSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const fromValue = readQueryString(req.query.from as QueryValue);
    const toValue = readQueryString(req.query.to as QueryValue);
    const paymentMethod =
      readQueryString(req.query.paymentMethod as QueryValue) ?? "all";
    const plan = readQueryString(req.query.plan as QueryValue) ?? "all";

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    try {
      fromDate = parseDate(fromValue, "from");
      toDate = parseDate(toValue, "to");
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid date",
      });
    }

    const now = new Date();

    // Default timeline: current month and previous 11 months.
    if (!fromDate && !toDate) {
      fromDate = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
      );
      toDate = new Date(now);
    }

    if (fromDate && toDate && fromDate > toDate) {
      return res
        .status(400)
        .json({ message: "'from' must be before or equal to 'to'" });
    }

    // Treat date-only end values as inclusive through the end of that UTC day.
    if (toValue && /^\d{4}-\d{2}-\d{2}$/.test(toValue) && toDate) {
      toDate.setUTCHours(23, 59, 59, 999);
    }

    if (
      paymentMethod !== "all" &&
      !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)
    ) {
      return res.status(400).json({ message: "Invalid paymentMethod" });
    }

    if (plan !== "all" && !(PLANS as readonly string[]).includes(plan)) {
      return res.status(400).json({ message: "Invalid plan" });
    }

    // Common filters applied to every summary and breakdown.
    const baseMatch: Record<string, unknown> = {
      isDeleted: { $ne: true },
      paymentStatus: "verified",
      currency: "BDT",
    };

    if (paymentMethod !== "all") {
      baseMatch.paymentMethod = paymentMethod;
    }

    if (plan !== "all") {
      baseMatch.plan = plan;
    }

    // Date range for the selected report.
    const dateMatch: Record<string, unknown> = {};

    if (fromDate || toDate) {
      dateMatch.createdAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    // Current UTC calendar month, calculated independently of dateMatch.
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [result] = await Payment.aggregate([
      { $match: baseMatch },
      {
        $facet: {
          // Overall summary for the selected date range.
          totals: [
            ...(Object.keys(dateMatch).length ? [{ $match: dateMatch }] : []),
            {
              $group: {
                _id: null,
                revenue: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
                averagePayment: { $avg: "$amount" },
                customers: { $addToSet: "$userId" },
              },
            },
            {
              $project: {
                _id: 0,
                revenue: 1,
                paymentCount: 1,
                averagePayment: {
                  $round: [{ $ifNull: ["$averagePayment", 0] }, 2],
                },
                uniqueCustomers: { $size: "$customers" },
              },
            },
          ],

          // This month ignores the selected from/to date range.
          // It still respects paymentMethod and plan filters.
          thisMonth: [
            {
              $match: {
                createdAt: {
                  $gte: monthStart,
                  $lt: nextMonthStart,
                },
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                revenue: 1,
                paymentCount: 1,
              },
            },
          ],

          // Monthly sales timeline for the selected date range.
          timeline: [
            ...(Object.keys(dateMatch).length ? [{ $match: dateMatch }] : []),
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m",
                    date: "$createdAt",
                    timezone: "UTC",
                  },
                },
                revenue: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: "$_id",
                revenue: 1,
                paymentCount: 1,
              },
            },
          ],

          // Sales grouped by payment method for the selected date range.
          byMethod: [
            ...(Object.keys(dateMatch).length ? [{ $match: dateMatch }] : []),
            {
              $group: {
                _id: "$paymentMethod",
                revenue: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
            {
              $project: {
                _id: 0,
                name: "$_id",
                revenue: 1,
                paymentCount: 1,
              },
            },
          ],

          // Sales grouped by plan for the selected date range.
          byPlan: [
            ...(Object.keys(dateMatch).length ? [{ $match: dateMatch }] : []),
            {
              $group: {
                _id: "$plan",
                revenue: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
            {
              $project: {
                _id: 0,
                name: "$_id",
                revenue: 1,
                paymentCount: 1,
              },
            },
          ],
        },
      },
    ]);

    // Fill missing months so the monthly bar chart stays continuous.
    const rawTimeline = (result?.timeline ?? []) as {
      date: string;
      revenue: number;
      paymentCount: number;
    }[];

    const timeline =
      fromDate && toDate
        ? getMonthKeys(fromDate, toDate).map((date) => {
            const existing = rawTimeline.find((item) => item.date === date);

            return (
              existing ?? {
                date,
                revenue: 0,
                paymentCount: 0,
              }
            );
          })
        : rawTimeline;

    return res.json({
      filters: {
        from: fromDate?.toISOString() ?? null,
        to: toDate?.toISOString() ?? null,
        groupBy: "month",
        paymentMethod,
        plan,
      },

      summary: {
        ...(result?.totals?.[0] ?? {
          revenue: 0,
          paymentCount: 0,
          averagePayment: 0,
          uniqueCustomers: 0,
        }),

        thisMonth: result?.thisMonth?.[0] ?? {
          revenue: 0,
          paymentCount: 0,
        },
      },

      timeline,
      byMethod: result?.byMethod ?? [],
      byPlan: result?.byPlan ?? [],
    });
  } catch (error) {
    return next(error);
  }
}
