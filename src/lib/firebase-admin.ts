import dotenv from "dotenv";
import admin from "firebase-admin";
dotenv.config();
if (!admin.apps.length) {
  console.log(
    "process.env.FIREBASE_PROJECT_ID,",
    process.env.FIREBASE_PROJECT_ID,
  );
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = admin.auth();
export const adminDB = admin.firestore();
export default admin;
