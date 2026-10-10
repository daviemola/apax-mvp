import "dotenv/config";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";

import activityRoutes from "./routes/activity";
import balanceRoutes from "./routes/balance";
import userRoutes from "./routes/users";
import connectDatabase from "./config/database";
import { getJWTSecret } from "./utils/jwt";

getJWTSecret();

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", message: "APAX backend is running" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/activity", activityRoutes);
app.use("/balance", balanceRoutes);
app.use("/user", userRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    const message =
      statusCode < 500 && error instanceof Error
        ? error.message
        : "Internal server error";

    if (statusCode >= 500) {
      console.error("[api] request failed:", error);
    }

    res.status(statusCode).json({ success: false, message });
  }
);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`APAX backend listening on port ${port}`);
});

void connectDatabase().catch((error: unknown) => {
  console.error("[database] MongoDB connection failed:", error);
});

server.on("error", (error: Error) => {
  console.error("[server] failed to start:", error);
  process.exitCode = 1;
});