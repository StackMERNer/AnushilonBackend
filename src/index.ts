import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Application, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db";
import authRoutes from "./routes/authRoutes";

import ms from "ms";
import { errorHandler } from "./middlewares/errorMiddleware";
import academicTreeRoutes from "./routes/academic-tree.route";
import contentNodeRoutes from "./routes/content-node.route";
import contentRoutes from "./routes/content.route";
import dashboardRoutes from "./routes/dashboard.route";
import healthRoutes from "./routes/health";
import homeRoutes from "./routes/home";
import imageRoutes from "./routes/imageRoutes";
import paymentRoutes from "./routes/payment.routes";
import paperRoutes from "./routes/question-paper.route";
import questionPdfRoutes from "./routes/question-pdf.routes";
import questionRoutes from "./routes/question.route";
import userRoutes from "./routes/user-routes";
import questionAnalyticsRoutes from "./routes/question-analytics.routes";

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = [
  "http://localhost:3000",
  "https://anushilon.net",
  "https://www.proshnokosh.com",
  "http://192.168.0.103:3000",
];
const app: Application = express();
app.set("trust proxy", 1);
// app.use(cors());
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: ms("5m"), // 5 minutes
  max: 500, // limit each IP to 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    res.status(429).json({
      message: "Too many requests. Please try again later.",
    });
  },
});

// Middleware

app.use(express.json());
app.use(cookieParser());

app.use(globalLimiter);

// Routes
app.use("/", homeRoutes);
app.use("/status", healthRoutes);
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/images", imageRoutes);
app.use("/question-papers", paperRoutes);
app.use("/academic", academicTreeRoutes);
app.use("/questions", questionRoutes);

app.use("/question-pdf", questionPdfRoutes);
app.use("/content-nodes", contentNodeRoutes);
app.use("/contents", contentRoutes);

app.use("/dashboard", dashboardRoutes);

app.use("/payments", paymentRoutes);

app.use("/analytics/question-analytics", questionAnalyticsRoutes);

app.get("/server-time", (req, res) => {
  res.json({ serverTime: new Date().toISOString() });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    console.log("🔌 Connecting to database...");
    await connectDB();
    console.log(" Database connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
