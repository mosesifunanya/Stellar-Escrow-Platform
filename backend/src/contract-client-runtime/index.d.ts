import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128 } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCC7XVVJTLC7FIEYYDGVDNRR7SLACNJCSBV3EQRGOFPP6Y5L4DAYS22A";
    };
};
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
export type DataKey = {
    tag: "NextEscrowId";
    values: void;
} | {
    tag: "Escrow";
    values: readonly [u32];
};
export interface Milestone {
    amount: i128;
    id: u32;
    status: MilestoneStatus;
}
export type EscrowStatus = {
    tag: "Active";
    values: void;
} | {
    tag: "Released";
    values: void;
} | {
    tag: "Refunded";
    values: void;
} | {
    tag: "Disputed";
    values: void;
};
export type DisputeWinner = {
    tag: "Worker";
    values: void;
} | {
    tag: "Payer";
    values: void;
};
export type MilestoneStatus = {
    tag: "Pending";
    values: void;
} | {
    tag: "Released";
    values: void;
};
export interface Client {
    /**
     * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_escrow: ({ escrow_id }: {
        escrow_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Escrow>>;
    /**
     * Construct and simulate a open_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    open_dispute: ({ escrow_id }: {
        escrow_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a cancel_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    cancel_escrow: ({ escrow_id }: {
        escrow_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    create_escrow: ({ payer, worker, arbiter, token, amount, deadline, milestones }: {
        payer: string;
        worker: string;
        arbiter: string;
        token: string;
        amount: i128;
        deadline: u64;
        milestones: Array<Milestone>;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a refund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    refund_escrow: ({ escrow_id }: {
        escrow_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    resolve_dispute: ({ escrow_id, winner }: {
        escrow_id: u32;
        winner: DisputeWinner;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_escrow_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_escrow_count: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a release_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    release_milestone: ({ escrow_id, milestone_id }: {
        escrow_id: u32;
        milestone_id: u32;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_escrow: (json: string) => AssembledTransaction<Escrow>;
        open_dispute: (json: string) => AssembledTransaction<null>;
        cancel_escrow: (json: string) => AssembledTransaction<null>;
        create_escrow: (json: string) => AssembledTransaction<number>;
        refund_escrow: (json: string) => AssembledTransaction<null>;
        resolve_dispute: (json: string) => AssembledTransaction<null>;
        get_escrow_count: (json: string) => AssembledTransaction<number>;
        release_milestone: (json: string) => AssembledTransaction<null>;
    };
}
