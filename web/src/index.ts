import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import { getJWTSecret } from "./utils/jwt";
import loginController from "./controllers/loginController";
import {
  AuthenticatedRequest,
  isAuthenticatedUser,
} from "./middlewares/user_actions/auth";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const envPath of [
  path.resolve(here, "..", ".env"),
  path.resolve(here, "config", ".config.env"),
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const port = Number(process.env.MINI_PORT || process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";
const corsEnabled = process.env.ENABLE_CORS !== "false";
const parsersEnabled = process.env.ENABLE_PARSERS !== "false";
const routesEnabled = process.env.ENABLE_ROUTES === "true";
const databaseEnabled = process.env.ENABLE_DB !== "false";

getJWTSecret();

const app = express();
const apiRoutes = express.Router();
const dashboardApiRoutes = express.Router();

app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  console.log(`[http] incoming ${req.method} ${req.originalUrl}`, {
    origin: req.headers.origin,
  });

  res.on("finish", () => {
    console.log(`[http] completed ${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      elapsedMs: Date.now() - startedAt,
    });
  });

  res.on("close", () => {
    if (!res.writableEnded) {
      console.warn(
        `[http] closed before response ${req.method} ${req.originalUrl}`,
        { elapsedMs: Date.now() - startedAt }
      );
    }
  });

  next();
});

if (corsEnabled) {
  app.use(
    cors({
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    })
  );
}

if (parsersEnabled) {
  app.use(cookieParser());
  app.use(express.json());
}

const health = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
};

app.get(["/", "/health", "/_health", "/__health"], health);
app.use(apiRoutes);
app.use("/api", dashboardApiRoutes);

let databaseReady = false;

const requireDatabase = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (databaseReady) {
    next();
    return;
  }

  const message = databaseEnabled
    ? "Database is not ready. Please try again shortly."
    : "Database-backed routes are disabled.";
  res.status(503).json({ success: false, message });
};

app.post("/user/login", requireDatabase, loginController);
app.get(
  "/user/me",
  requireDatabase,
  isAuthenticatedUser,
  (req: AuthenticatedRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: "Please Login to Access" });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  }
);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "API endpoint not found" });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const isMalformedJson =
      error instanceof SyntaxError &&
      "status" in error &&
      error.status === 400;
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : isMalformedJson
          ? 400
          : 500;
    const message = isMalformedJson
      ? "Request body must be valid JSON."
      : statusCode < 500 && error instanceof Error
        ? error.message
        : "Internal server error";

    if (statusCode >= 500) {
      console.error("[http] request failed:", error);
    }

    res.status(statusCode).json({ success: false, message });
  }
);

const server = app.listen(port, host, () => {
  console.log(`[server] listening on ${host}:${port}`);
  console.log(`[server] health check: http://localhost:${port}/__health`);
  console.log("[server] features:", {
    ENABLE_PARSERS: parsersEnabled,
    ENABLE_CORS: corsEnabled,
    ENABLE_DB: databaseEnabled,
    ENABLE_ROUTES: routesEnabled,
  });
});

server.on("error", (error: Error) => {
  console.error("[server] failed to listen:", error);
  process.exitCode = 1;
});

if (routesEnabled) {
  void Promise.all([
    import("./routes/activity"),
    import("./routes/balance"),
  ])
    .then(([activityModule, balanceModule]) => {
      apiRoutes.use("/activity", activityModule.default);
      apiRoutes.use("/balance", balanceModule.default);
      console.log("[routes] activity and balance routes loaded");
    })
    .catch((error: unknown) => {
      console.error("[routes] failed to load API routes:", error);
    });
}

void import("./routes/holdings")
  .then(({ default: holdingsRoutes }) => {
    dashboardApiRoutes.use(
      "/holdings",
      requireDatabase,
      holdingsRoutes
    );
    console.log("[routes] holdings route loaded at /api/holdings");
  })
  .catch((error: unknown) => {
    console.error("[routes] failed to load holdings route:", error);
  });

if (databaseEnabled) {
  void import("./config/database")
    .then(({ default: connectDatabase }) => connectDatabase())
    .then(() => {
      databaseReady = true;
      console.log("[db] connected; database-backed routes are ready");
    })
    .catch((error: unknown) => {
      console.error(
        "[db] connection failed; database-backed routes remain unavailable:",
        error
      );
    });
}
