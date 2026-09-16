import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { Keypair, Networks, Transaction } from "@stellar/stellar-sdk";

// Initialize Stellar Wallets Kit
StellarWalletsKit.init({
  modules: defaultModules(),
});

// Use Stellar Testnet
StellarWalletsKit.setNetwork(Networks.TESTNET);

// ============================================
// DEV-ONLY DEMO WALLET (inactive for real users)
// ============================================
// This shim only activates when an automation harness (e.g. Playwright)
// injects window.__DEMO_WALLET__ = { secret: "S..." } BEFORE the app loads.
// Real users never trigger it, so production wallet behavior is unchanged.
// Secrets are injected at runtime by the local demo driver, never committed.

const demoWallet = typeof window !== "undefined" && window.__DEMO_WALLET__;

function demoKeypair() {
  return Keypair.fromSecret(demoWallet.secret);
}

function wrapKit(kit) {
  if (!demoWallet) return kit;

  return {
    ...kit,
    async authModal() {
      return { address: demoKeypair().publicKey() };
    },
    async getAddress() {
      return { address: demoKeypair().publicKey() };
    },
    async signTransaction(xdr, _opts) {
      const tx = new Transaction(xdr, Networks.TESTNET);
      tx.sign(demoKeypair());
      return { signedTxXdr: tx.toXDR() };
    },
    async disconnect() {
      return;
    },
  };
}

const WrappedKit = wrapKit(StellarWalletsKit);

export default WrappedKit;
