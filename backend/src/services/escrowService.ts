import dotenv from "dotenv";

import { Client } from "../contract-client-runtime/index.js";

dotenv.config();

const CONTRACT_ID = process.env.STELLAR_CONTRACT_ID;

const RPC_URL = process.env.STELLAR_RPC_URL;

const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE;

if (!CONTRACT_ID || !RPC_URL || !NETWORK_PASSPHRASE) {
  throw new Error("Missing Stellar environment variables");
}

const getClient = (publicKey: string) => {
  console.log("Creating Stellar client...");
  console.log("Public key:", publicKey);

  return new Client({
    contractId: CONTRACT_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    publicKey,
  });
};

// GET ONE ESCROW

export const getEscrow = async (publicKey: string, escrowId: number) => {
  const client = getClient(publicKey);

  const result = await client.get_escrow({
    escrow_id: escrowId,
  });

  return result;
};

// GET ESCROW COUNT

export const getEscrowCount = async (publicKey: string) => {
  const client = getClient(publicKey);

  const result = await client.get_escrow_count();

  return result;
};

// GET ALL ESCROWS

export const getAllEscrows = async (publicKey: string) => {
  const countResult = await getEscrowCount(publicKey);

  const count = Number(countResult.result);

  const escrows = [];

  for (let i = 1; i <= count; i++) {
    try {
      const escrow = await getEscrow(publicKey, i);

      if (escrow.result) {
        escrows.push(escrow.result);
      }
    } catch (error) {
      console.log(`Escrow ${i} does not exist or could not be loaded.`);
    }
  }

  return escrows;
};

// CREATE ESCROW

export const createEscrow = async (
  publicKey: string,
  worker: string,
  arbiter: string,
  token: string,
  amount: bigint,
  deadline: bigint,
  milestones: {
    id: number;
    amount: bigint;
    status: {
      tag: "Pending" | "Released";
      values: undefined;
    };
  }[],
) => {
  console.log("Creating Stellar client...");

  const client = getClient(publicKey);

  console.log("Creating escrow transaction...");

  const transaction = await client.create_escrow({
    payer: publicKey,
    worker,
    arbiter,
    token,
    amount,
    deadline,
    milestones,
  });

  console.log("Escrow transaction created successfully.");

  console.log("TRANSACTION RESULT:", transaction);

  return transaction;
};

// RELEASE MILESTONE

export const releaseMilestone = async (
  publicKey: string,
  escrowId: number,
  milestoneId: number,
) => {
  const client = getClient(publicKey);

  console.log("Releasing milestone...");

  const transaction = await client.release_milestone({
    escrow_id: escrowId,
    milestone_id: milestoneId,
  });

  return transaction;
};

// OPEN DISPUTE

export const openDispute = async (publicKey: string, escrowId: number) => {
  const client = getClient(publicKey);

  console.log("Opening dispute...");

  const transaction = await client.open_dispute({
    escrow_id: escrowId,
  });

  return transaction;
};

// RESOLVE DISPUTE

export const resolveDispute = async (
  publicKey: string,
  escrowId: number,
  winner: "Worker" | "Payer",
) => {
  const client = getClient(publicKey);

  console.log("Resolving dispute...");

  const transaction = await client.resolve_dispute({
    escrow_id: escrowId,
    winner: {
      tag: winner,
      values: undefined,
    },
  });

  return transaction;
};

// REFUND ESCROW

export const refundEscrow = async (publicKey: string, escrowId: number) => {
  const client = getClient(publicKey);

  console.log("Refunding escrow...");

  const transaction = await client.refund_escrow({
    escrow_id: escrowId,
  });

  return transaction;
};

// CANCEL ESCROW

export const cancelEscrow = async (publicKey: string, escrowId: number) => {
  const client = getClient(publicKey);

  console.log("Cancelling escrow...");

  const transaction = await client.cancel_escrow({
    escrow_id: escrowId,
  });

  return transaction;
};
