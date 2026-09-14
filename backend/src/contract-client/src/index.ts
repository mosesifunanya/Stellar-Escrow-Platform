import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCC7XVVJTLC7FIEYYDGVDNRR7SLACNJCSBV3EQRGOFPP6Y5L4DAYS22A",
  }
} as const


export interface Escrow {
  amount: i128;
  arbiter: string;
  deadline: u64;
  milestones: Array<Milestone>;
  payer: string;
  remaining_amount: i128;
  status: EscrowStatus;
  token: string;
  worker: string;
}

export type DataKey = {tag: "NextEscrowId", values: void} | {tag: "Escrow", values: readonly [u32]};


export interface Milestone {
  amount: i128;
  id: u32;
  status: MilestoneStatus;
}

export type EscrowStatus = {tag: "Active", values: void} | {tag: "Released", values: void} | {tag: "Refunded", values: void} | {tag: "Disputed", values: void};

export type DisputeWinner = {tag: "Worker", values: void} | {tag: "Payer", values: void};




export type MilestoneStatus = {tag: "Pending", values: void} | {tag: "Released", values: void};




export interface Client {
  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>

  /**
   * Construct and simulate a open_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  open_dispute: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cancel_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_escrow: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_escrow: ({payer, worker, arbiter, token, amount, deadline, milestones}: {payer: string, worker: string, arbiter: string, token: string, amount: i128, deadline: u64, milestones: Array<Milestone>}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a refund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  refund_escrow: ({escrow_id}: {escrow_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolve_dispute: ({escrow_id, winner}: {escrow_id: u32, winner: DisputeWinner}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_escrow_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a release_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_milestone: ({escrow_id, milestone_id}: {escrow_id: u32, milestone_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABkVzY3JvdwAAAAAACQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAdhcmJpdGVyAAAAABMAAAAAAAAACGRlYWRsaW5lAAAABgAAAAAAAAAKbWlsZXN0b25lcwAAAAAD6gAAB9AAAAAJTWlsZXN0b25lAAAAAAAAAAAAAAVwYXllcgAAAAAAABMAAAAAAAAAEHJlbWFpbmluZ19hbW91bnQAAAALAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRXNjcm93U3RhdHVzAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABndvcmtlcgAAAAAAEw==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAAAAAAADE5leHRFc2Nyb3dJZAAAAAEAAAAAAAAABkVzY3JvdwAAAAAAAQAAAAQ=",
        "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAACaWQAAAAAAAQAAAAAAAAABnN0YXR1cwAAAAAH0AAAAA9NaWxlc3RvbmVTdGF0dXMA",
        "AAAAAgAAAAAAAAAAAAAADEVzY3Jvd1N0YXR1cwAAAAQAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAACFJlbGVhc2VkAAAAAAAAAAAAAAAIUmVmdW5kZWQAAAAAAAAAAAAAAAhEaXNwdXRlZA==",
        "AAAAAgAAAAAAAAAAAAAADURpc3B1dGVXaW5uZXIAAAAAAAACAAAAAAAAAAAAAAAGV29ya2VyAAAAAAAAAAAAAAAAAAVQYXllcgAAAA==",
        "AAAABQAAAAAAAAAAAAAADURpc3B1dGVPcGVuZWQAAAAAAAABAAAADmRpc3B1dGVfb3BlbmVkAAAAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAADUVzY3Jvd0NyZWF0ZWQAAAAAAAABAAAADmVzY3Jvd19jcmVhdGVkAAAAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAADkVzY3Jvd1JlZnVuZGVkAAAAAAABAAAAD2VzY3Jvd19yZWZ1bmRlZAAAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAQAAAAI=",
        "AAAAAgAAAAAAAAAAAAAAD01pbGVzdG9uZVN0YXR1cwAAAAACAAAAAAAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAhSZWxlYXNlZA==",
        "AAAABQAAAAAAAAAAAAAAD0Rpc3B1dGVSZXNvbHZlZAAAAAABAAAAEGRpc3B1dGVfcmVzb2x2ZWQAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAAD0VzY3Jvd0NhbmNlbGxlZAAAAAABAAAAEGVzY3Jvd19jYW5jZWxsZWQAAAABAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAQAAAAI=",
        "AAAABQAAAAAAAAAAAAAAEU1pbGVzdG9uZVJlbGVhc2VkAAAAAAAAAQAAABJtaWxlc3RvbmVfcmVsZWFzZWQAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAABAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAQAAAAI=",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAEAAAfQAAAABkVzY3JvdwAA",
        "AAAAAAAAAAAAAAAMb3Blbl9kaXNwdXRlAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABAAAAAA=",
        "AAAAAAAAAAAAAAANY2FuY2VsX2VzY3JvdwAAAAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAANY3JlYXRlX2VzY3JvdwAAAAAAAAcAAAAAAAAABXBheWVyAAAAAAAAEwAAAAAAAAAGd29ya2VyAAAAAAATAAAAAAAAAAdhcmJpdGVyAAAAABMAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAACm1pbGVzdG9uZXMAAAAAA+oAAAfQAAAACU1pbGVzdG9uZQAAAAAAAAEAAAAE",
        "AAAAAAAAAAAAAAANcmVmdW5kX2VzY3JvdwAAAAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAA",
        "AAAAAAAAAAAAAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAQAAAAAAAAABndpbm5lcgAAAAAH0AAAAA1EaXNwdXRlV2lubmVyAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAQZ2V0X2VzY3Jvd19jb3VudAAAAAAAAAABAAAABA==",
        "AAAAAAAAAAAAAAARcmVsZWFzZV9taWxlc3RvbmUAAAAAAAACAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAEAAAAAAAAAAxtaWxlc3RvbmVfaWQAAAAEAAAAAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_escrow: this.txFromJSON<Escrow>,
        open_dispute: this.txFromJSON<null>,
        cancel_escrow: this.txFromJSON<null>,
        create_escrow: this.txFromJSON<u32>,
        refund_escrow: this.txFromJSON<null>,
        resolve_dispute: this.txFromJSON<null>,
        get_escrow_count: this.txFromJSON<u32>,
        release_milestone: this.txFromJSON<null>
  }
}