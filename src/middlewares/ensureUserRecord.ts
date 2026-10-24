import { Request, Response, NextFunction, RequestHandler } from "express";
import { timingSafeEqual } from "crypto";
import { adminAuth } from "../lib/firebase-admin";
import { User } from "../models/User";
import { DecodedIdToken } from "firebase-admin/auth";

export function verifyInternalSecret(provided: string | undefined): boolean {
  const expected = process.env.INTERNAL_SECRET!;
  if (!provided || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export const ensureUserRecord: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const tokenType = req.headers["x-token-type"] as "session" | undefined;
    const internalSecret = req.headers["x-internal-secret"] as
      | string
      | undefined;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized." });
      return;
    }

    const token = authHeader.split("Bearer ")[1];
    // Session cookies only ever arrive from our own server — require the internal secret.
    if (tokenType === "session" && !verifyInternalSecret(internalSecret)) {
      res.status(403).json({ message: "Forbidden." });
      return;
    }

    let decoded: DecodedIdToken;

    try {
      decoded =
        tokenType === "session"
          ? await adminAuth.verifySessionCookie(token, true)
          : await adminAuth.verifyIdToken(token);
    } catch (err) {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    const uid = decoded.uid;
    const email = decoded.email ?? null;
    const name = decoded.name;
    const photoURL = decoded.picture;

    if (!uid) {
      res.status(401).json({ message: "Invalid token." });
      return;
    }

    // Find user by firebaseUid
    let user = await User.findOne({ uid });

    // Fallback: email lookup
    if (!user) {
      if (!email) {
        res.status(400).json({ message: "User has no email." });
        return;
      }

      user = await User.findOne({ email });
      if (user) {
        user.uid = uid;
        await user.save();
      } else {
        user = await User.create({ uid, email, name, photoURL });
      }
    }

    (req as any).firebaseUid = uid;
    (req as any).user = user;

    next();
  } catch (err) {
    console.error("Error in ensureUserRecord:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
