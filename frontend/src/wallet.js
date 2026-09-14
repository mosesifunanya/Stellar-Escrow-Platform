import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { Networks } from "@stellar/stellar-sdk";

// Initialize Stellar Wallets Kit
StellarWalletsKit.init({
  modules: defaultModules(),
});

// Use Stellar Testnet
StellarWalletsKit.setNetwork(Networks.TESTNET);

export default StellarWalletsKit;
