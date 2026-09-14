import express from "express";

import {
  getEscrowById,
  getAllEscrowsController,
  createEscrowController,
  releaseMilestoneController,
  openDisputeController,
  resolveDisputeController,
  refundEscrowController,
  cancelEscrowController,
} from "../controllers/escrowController.js";

const router = express.Router();

router.get("/", getAllEscrowsController);

router.get("/:id", getEscrowById);

router.post("/", createEscrowController);

router.post("/:id/release-milestone", releaseMilestoneController);

router.post("/:id/open-dispute", openDisputeController);

router.post("/:id/resolve-dispute", resolveDisputeController);

router.post("/:id/refund", refundEscrowController);

router.post("/:id/cancel", cancelEscrowController);

export default router;
