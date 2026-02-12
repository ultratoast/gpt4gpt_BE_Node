import "dotenv/config";
import express from "express";
import cors from "cors";
import conversationRouter from "./api/conversation/conversation";
import { requireApiToken } from "./middleware/auth";

const app = express();
app.use(express.json());

// Only allow browser origin exampledomain.com (CORS is browser-only enforcement)
const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost";
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Protect all /api/* endpoints except health
app.use("/api", (req, res, next) => {
  return requireApiToken(req, res, next);
});

// Conversation routes mounted under /api/conversation
app.use("/api/conversation", conversationRouter);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`Backend listening on :${port}`));
