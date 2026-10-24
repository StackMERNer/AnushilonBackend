import { Router } from "express";

import {
  recordPayment,
  getUserPaymentHistory,
  getAllPayments,
  updatePaymentStatus,
  updatePaymentInfo,
  deletePayment,
  getPaymentSalesSummary,
} from "../controllers/payment.controller";
import { authenticate } from "../middlewares/authMiddleware";
import adminMiddleware from "../middlewares/adminMiddleware";

const router = Router();
router.use(authenticate);
// User routes
router.post("/", authenticate, recordPayment);

router.get("/history", getUserPaymentHistory);

// Admin routes
router.use(adminMiddleware);

router.get("/all", getAllPayments);

router.patch("/:paymentId", updatePaymentInfo);

router.patch("/:paymentId/status", updatePaymentStatus);

router.delete("/:paymentId", deletePayment);

router.get("/sales-summary", getPaymentSalesSummary);

export default router;
