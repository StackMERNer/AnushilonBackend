import { Request, Response, NextFunction, RequestHandler } from "express";
import { timingSafeEqual } from "crypto";
import { adminAuth } from "../lib/firebase-admin";
import { User } from "../models/User";
import { DecodedIdToken } from "firebase-admin/auth";

export function verifyInternalSecret(provided: string | undefined): boolean {
  const expected = process.env.INTERNAL_SECRET;

  if (!expected || !provided || provided.length !== expected.length) {
    return false;
  }

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

    const token = authHeader.slice(7);

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
    } catch {
      res.status(401).json({
        message: "Invalid or expired token.",
      });
      return;
    }

    const { uid, email, name, picture: photoURL } = decoded;

    if (!uid) {
      res.status(401).json({ message: "Invalid token." });
      return;
    }

    // First, find the user by Firebase UID.
    let user = await User.findOne({ uid });

    if (!user) {
      // Preserve the existing email migration/fallback behavior.
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        // Another request may have assigned this UID in the meantime.
        if (user.uid !== uid) {
          try {
            user.uid = uid;
            await user.save();
          } catch (err: any) {
            if (err?.code !== 11000) {
              throw err;
            }

            // A concurrent request may have completed the migration.
            user = await User.findOne({ uid });

            if (!user) {
              throw err;
            }
          }
        }
      } else {
        // Atomic creation: concurrent requests cannot create
        // separate records for the same UID.
        try {
          user = await User.findOneAndUpdate(
            { uid },
            {
              $setOnInsert: {
                uid,
                email: email ?? null,
                name,
                photoURL,
              },
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
            },
          );
        } catch (err: any) {
          // Handle a race with another request that inserted the UID.
          if (err?.code !== 11000) {
            throw err;
          }

          user = await User.findOne({ uid });

          if (!user) {
            throw err;
          }
        }
      }
    }

    if (!user) {
      res.status(500).json({
        message: "Unable to resolve user record.",
      });
      return;
    }

    (req as any).firebaseUid = uid;
    (req as any).user = user;

    next();
  } catch (err) {
    console.error("Error in ensureUserRecord:", err);

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
