import {
  createEscrow,
  getEscrow,
  getAllEscrows,
  releaseMilestone,
  openDispute,
  resolveDispute,
  refundEscrow,
  cancelEscrow,
} from "../services/escrowService.js";

// ==========================================
// GET ONE ESCROW
// ==========================================

export const getEscrowById = async (req: any, res: any) => {
  try {
    const publicKey = req.query.publicKey || req.body?.publicKey;

    const escrowId = Number(req.params.id);

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    console.log("Getting escrow:", escrowId);
    console.log("Public key:", publicKey);

    const escrow = await getEscrow(publicKey, escrowId);

    // Convert BigInt values to strings
    const safeEscrow = JSON.parse(
      JSON.stringify(escrow.result, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    return res.status(200).json({
      status: "success",
      data: safeEscrow,
    });
  } catch (error) {
    console.error("Get escrow error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not load escrow.",
    });
  }
};

// ==========================================
// GET ALL ESCROWS
// ==========================================

export const getAllEscrowsController = async (req: any, res: any) => {
  try {
    const publicKey = req.query.publicKey || req.body?.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    console.log("Getting all escrows for:", publicKey);

    const escrows = await getAllEscrows(publicKey);

    // Convert BigInt values to strings
    // so JSON can send them to React
    const safeEscrows = JSON.parse(
      JSON.stringify(escrows, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    return res.status(200).json({
      status: "success",
      data: safeEscrows,
    });
  } catch (error) {
    console.error("Get all escrows error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not load escrows.",
    });
  }
};

// ==========================================
// CREATE ESCROW
// ==========================================

export const createEscrowController = async (req: any, res: any) => {
  try {
    const { payer, worker, arbiter, token, amount, deadline, milestones } =
      req.body;

    if (!payer) {
      return res.status(400).json({
        status: "error",
        message: "Payer is required.",
      });
    }

    if (!worker) {
      return res.status(400).json({
        status: "error",
        message: "Worker is required.",
      });
    }

    if (!arbiter) {
      return res.status(400).json({
        status: "error",
        message: "Arbiter is required.",
      });
    }

    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "Token is required.",
      });
    }

    if (!amount) {
      return res.status(400).json({
        status: "error",
        message: "Amount is required.",
      });
    }

    if (!deadline) {
      return res.status(400).json({
        status: "error",
        message: "Deadline is required.",
      });
    }

    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({
        status: "error",
        message: "Milestones are required.",
      });
    }

    if (milestones.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "At least one milestone is required.",
      });
    }

    console.log("Creating escrow with:");
    console.log("Payer:", payer);
    console.log("Worker:", worker);
    console.log("Arbiter:", arbiter);
    console.log("Token:", token);
    console.log("Amount:", amount);
    console.log("Deadline:", deadline);
    console.log("Milestones:", milestones);

    const formattedMilestones = milestones.map((milestone: any) => ({
      id: Number(milestone.id),
      amount: BigInt(milestone.amount),
      status: {
        tag: milestone.status || "Pending",
        values: undefined,
      },
    }));

    console.log("Formatted milestones:", formattedMilestones);

    const transaction = await createEscrow(
      payer,
      worker,
      arbiter,
      token,
      BigInt(amount),
      BigInt(deadline),
      formattedMilestones,
    );

    console.log("Escrow transaction created successfully.");

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Create escrow error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not create escrow.",
    });
  }
};

// ==========================================
// RELEASE MILESTONE
// ==========================================

export const releaseMilestoneController = async (req: any, res: any) => {
  try {
    const escrowId = Number(req.params.id);
    const milestoneId = Number(req.body.milestoneId);

    const publicKey = req.body.publicKey || req.query.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    if (!milestoneId || milestoneId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid milestone ID is required.",
      });
    }

    console.log("Releasing milestone:");
    console.log("Escrow ID:", escrowId);
    console.log("Milestone ID:", milestoneId);
    console.log("Public key:", publicKey);

    const transaction = await releaseMilestone(
      publicKey,
      escrowId,
      milestoneId,
    );

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Release milestone error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not release milestone.",
    });
  }
};

// ==========================================
// OPEN DISPUTE
// ==========================================

export const openDisputeController = async (req: any, res: any) => {
  try {
    const escrowId = Number(req.params.id);

    const publicKey = req.body.publicKey || req.query.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    console.log("Opening dispute:");
    console.log("Escrow ID:", escrowId);
    console.log("Public key:", publicKey);

    const transaction = await openDispute(publicKey, escrowId);

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Open dispute error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not open dispute.",
    });
  }
};

// ==========================================
// RESOLVE DISPUTE
// ==========================================

export const resolveDisputeController = async (req: any, res: any) => {
  try {
    const escrowId = Number(req.params.id);
    const winner = req.body.winner;

    const publicKey = req.body.publicKey || req.query.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    if (winner !== "Worker" && winner !== "Payer") {
      return res.status(400).json({
        status: "error",
        message: 'Winner must be either "Worker" or "Payer".',
      });
    }

    console.log("Resolving dispute:");
    console.log("Escrow ID:", escrowId);
    console.log("Winner:", winner);
    console.log("Public key:", publicKey);

    const transaction = await resolveDispute(publicKey, escrowId, winner);

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Resolve dispute error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not resolve dispute.",
    });
  }
};

// ==========================================
// REFUND ESCROW
// ==========================================

export const refundEscrowController = async (req: any, res: any) => {
  try {
    const escrowId = Number(req.params.id);

    const publicKey = req.body.publicKey || req.query.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    console.log("Refunding escrow:");
    console.log("Escrow ID:", escrowId);
    console.log("Public key:", publicKey);

    const transaction = await refundEscrow(publicKey, escrowId);

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Refund escrow error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not refund escrow.",
    });
  }
};

// ==========================================
// CANCEL ESCROW
// ==========================================

export const cancelEscrowController = async (req: any, res: any) => {
  try {
    const escrowId = Number(req.params.id);

    const publicKey = req.body.publicKey || req.query.publicKey;

    if (!publicKey) {
      return res.status(400).json({
        status: "error",
        message: "publicKey is required.",
      });
    }

    if (!escrowId || escrowId <= 0) {
      return res.status(400).json({
        status: "error",
        message: "A valid escrow ID is required.",
      });
    }

    console.log("Cancelling escrow:");
    console.log("Escrow ID:", escrowId);
    console.log("Public key:", publicKey);

    const transaction = await cancelEscrow(publicKey, escrowId);

    return res.status(200).json({
      status: "success",
      data: transaction,
    });
  } catch (error) {
    console.error("Cancel escrow error:", error);

    return res.status(500).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not cancel escrow.",
    });
  }
};
