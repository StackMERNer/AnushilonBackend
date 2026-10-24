import { NextFunction, Request, Response } from "express";
import { PLAN_FEATURES } from "../config/subscription";

export const requireFeature =
    (feature: keyof typeof PLAN_FEATURES["PRO"]) =>
        (req: Request, res: Response, next: NextFunction) => {
            const plan = ((req as any).user?.plan || "FREE") as keyof typeof PLAN_FEATURES;

            if (!PLAN_FEATURES[plan][feature]) {
                return res.status(403).json({
                    message: "Upgrade required",
                    feature,
                });
            }

            next();
        };
