import express from "express";
import cors from "cors";
import escrowRoutes from "./routes/escrowRoutes.js";

const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "StellarChain API is running",
  });
});

app.use("/api/escrows", escrowRoutes);

export default app;
