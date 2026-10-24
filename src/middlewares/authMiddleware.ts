import dotenv from "dotenv";
import { ensureUserRecord } from "./ensureUserRecord";
dotenv.config();

export const authenticate = ensureUserRecord;
