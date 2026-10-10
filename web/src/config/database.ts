import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI as string;

const connectDatabase = async (): Promise<void> => {
  console.log("[database] Checking MongoDB configuration");

  if (!MONGO_URI) {
    console.error("[database] MONGO_URI is missing");
    throw new Error("MONGO_URI is not configured");
  }

  const startedAt = Date.now();
  console.log("[database] MongoDB URI is configured; starting connection attempt");

  try {
    await mongoose.connect(MONGO_URI, {
      connectTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 10_000,
    });

    console.log("[database] MongoDB connected", {
      elapsedMs: Date.now() - startedAt,
      readyState: mongoose.connection.readyState,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const code =
      "code" in err && (typeof err.code === "string" || typeof err.code === "number")
        ? err.code
        : undefined;

    console.error("[database] MongoDB connection failed", {
      elapsedMs: Date.now() - startedAt,
      errorName: err.name,
      errorCode: code,
      errorMessage: err.message.replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@"),
      readyState: mongoose.connection.readyState,
    });
    throw error;
  }
};

export default connectDatabase;