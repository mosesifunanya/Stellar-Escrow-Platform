import { useState, useEffect } from "react";
import "./App.css";
import StellarWalletsKit from "./wallet";
import { Networks } from "@stellar/stellar-sdk";
import mosesPhoto from "./assets/moses.jpeg";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [theme, setTheme] = useState("dark");

  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [creatingEscrow, setCreatingEscrow] = useState(false);

  const [escrows, setEscrows] = useState([]);
  const [loadingEscrows, setLoadingEscrows] = useState(false);
  const [selectedEscrow, setSelectedEscrow] = useState(null);
  const [releasingMilestone, setReleasingMilestone] = useState(null);
  const [openingDispute, setOpeningDispute] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState(false);
  const [refundingEscrow, setRefundingEscrow] = useState(false);
  const [cancellingEscrow, setCancellingEscrow] = useState(false);
  const [notification, setNotification] = useState(null);

  const [showCreateEscrow, setShowCreateEscrow] = useState(false);
  const [escrowStep, setEscrowStep] = useState(1);

  const [formData, setFormData] = useState({
    worker: "",
    arbiter: "",
    amount: "",
    deadline: "",
  });

  const [milestones, setMilestones] = useState([
    {
      id: 1,
      amount: "",
    },
  ]);

  const navItems = ["Dashboard", "Escrows", "Activity"];

  // ==========================================
  // STELLAR CONFIGURATION
  // ==========================================

  const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const CONTRACT_ID =
    "CCC7XVVJTLC7FIEYYDGVDNRR7SLACNJCSBV3EQRGOFPP6Y5L4DAYS22A";

  const API_URL =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.DEV ? "http://localhost:5000" : "");

  const STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";

  // ==========================================
  // THEME
  // ==========================================

  useEffect(() => {
    const savedTheme = localStorage.getItem("stellarchain-theme");

    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    localStorage.setItem("stellarchain-theme", theme);
  }, [theme]);

  // ==========================================
  // MODAL BODY SCROLL
  // ==========================================

  useEffect(() => {
    if (showCreateEscrow) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showCreateEscrow]);

  // ==========================================
  // ESC KEY
  // ==========================================

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && showCreateEscrow) {
        closeCreateEscrow();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showCreateEscrow]);

  // ==========================================
  // LOAD ESCROWS WHEN WALLET CHANGES
  // ==========================================

  useEffect(() => {
    if (walletAddress) {
      loadEscrows(walletAddress);
    }
  }, [walletAddress]);

  // ==========================================
  // THEME
  // ==========================================

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === "dark" ? "light" : "dark"));
  };

  // ==========================================
  // NAVIGATION
  // ==========================================

  const handleNavigation = (item) => {
    setActivePage(item);
    setMenuOpen(false);
  };

  // ==========================================
  // CONNECT WALLET
  // ==========================================

  const connectWallet = async () => {
    try {
      setConnecting(true);
      setWalletMenuOpen(false);

      console.log("Opening wallet...");

      await StellarWalletsKit.authModal();

      const { address } = await StellarWalletsKit.getAddress();

      if (!address) {
        throw new Error("No wallet address was returned.");
      }

      console.log("Connected wallet:", address);

      setWalletAddress(address);

      // Remember the public wallet address locally.
      localStorage.setItem("stellarchain-wallet-address", address);

      return address;
    } catch (error) {
      console.error("Wallet connection failed:", error);

      showNotification(
        error instanceof Error ? error.message : "Could not connect wallet.",
        "error",
        "Wallet connection failed",
      );

      return null;
    } finally {
      setConnecting(false);
    }
  };

  // ==========================================
  // RESTORE WALLET AFTER REFRESH
  // ==========================================

  useEffect(() => {
    const restoreWallet = async () => {
      try {
        // First restore the saved public address immediately.
        const savedAddress = localStorage.getItem(
          "stellarchain-wallet-address",
        );

        if (savedAddress) {
          setWalletAddress(savedAddress);
          console.log("Restored saved wallet:", savedAddress);
        }

        // Then ask the wallet kit for its current connected address.
        // This keeps the app synced with the actual wallet session when available.
        try {
          const { address } = await StellarWalletsKit.getAddress();

          if (address) {
            setWalletAddress(address);
            localStorage.setItem("stellarchain-wallet-address", address);
            console.log("Wallet session restored:", address);
          }
        } catch (walletError) {
          console.log("No active wallet session found.");
        }
      } catch (error) {
        console.error("Could not restore wallet:", error);
      }
    };

    restoreWallet();
  }, []);

  // ==========================================
  // DISCONNECT WALLET
  // ==========================================

  const disconnectWallet = async () => {
    try {
      setWalletMenuOpen(false);

      // Ask the wallet kit to end its session if the method is available.
      if (typeof StellarWalletsKit.disconnect === "function") {
        await StellarWalletsKit.disconnect();
      }
    } catch (error) {
      console.log("Wallet kit disconnect notice:", error);
    } finally {
      // Remove only our saved public address. Never store or remove private keys.
      localStorage.removeItem("stellarchain-wallet-address");
      setWalletAddress("");
      setEscrows([]);
      setSelectedEscrow(null);

      showNotification(
        "Your wallet has been disconnected.",
        "success",
        "Wallet disconnected",
      );
    }
  };

  // ==========================================
  // LOAD ALL ESCROWS
  // ==========================================

  const loadEscrows = async (address = walletAddress) => {
    if (!address) {
      setEscrows([]);
      return;
    }

    try {
      setLoadingEscrows(true);

      console.log("Loading escrows from backend...");

      const response = await fetch(
        `${API_URL}/api/escrows?publicKey=${encodeURIComponent(address)}`,
      );

      const result = await response.json();

      console.log("Escrows from backend:", result);

      if (!response.ok) {
        throw new Error(result.error || "Could not load escrows.");
      }

      const allEscrows = result.data || [];

      const userEscrows = allEscrows
        .map((escrow, index) => ({
          ...escrow,
          id: escrow.id ?? index + 1,
        }))
        .filter((escrow) => {
          return (
            escrow.payer === address ||
            escrow.worker === address ||
            escrow.arbiter === address
          );
        });

      console.log("Escrows belonging to wallet:", userEscrows);

      setEscrows(userEscrows);
    } catch (error) {
      console.error("Could not load escrows:", error);

      setEscrows([]);
    } finally {
      setLoadingEscrows(false);
    }
  };

  // ==========================================
  // OPEN CREATE ESCROW
  // ==========================================

  const openCreateEscrow = async () => {
    if (!walletAddress) {
      const address = await connectWallet();

      if (!address) {
        return;
      }
    }

    setEscrowStep(1);
    setShowCreateEscrow(true);
  };

  // ==========================================
  // CLOSE CREATE ESCROW
  // ==========================================

  const closeCreateEscrow = () => {
    if (creatingEscrow) {
      return;
    }

    setShowCreateEscrow(false);
    setEscrowStep(1);
  };

  // ==========================================
  // FORM INPUT
  // ==========================================

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ==========================================
  // MILESTONE INPUT
  // ==========================================

  const handleMilestoneChange = (id, value) => {
    setMilestones((previous) =>
      previous.map((milestone) =>
        milestone.id === id
          ? {
              ...milestone,
              amount: value,
            }
          : milestone,
      ),
    );
  };

  // ==========================================
  // ADD MILESTONE
  // ==========================================

  const addMilestone = () => {
    const nextId =
      milestones.length > 0
        ? Math.max(...milestones.map((milestone) => milestone.id)) + 1
        : 1;

    setMilestones((previous) => [
      ...previous,
      {
        id: nextId,
        amount: "",
      },
    ]);
  };

  // ==========================================
  // REMOVE MILESTONE
  // ==========================================

  const removeMilestone = (id) => {
    if (milestones.length === 1) {
      return;
    }

    setMilestones((previous) =>
      previous.filter((milestone) => milestone.id !== id),
    );
  };

  // ==========================================
  // MILESTONE TOTAL
  // ==========================================

  const milestoneTotal = milestones.reduce((total, milestone) => {
    return total + Number(milestone.amount || 0);
  }, 0);

  const amountMatchesMilestones =
    formData.amount !== "" && Number(formData.amount) === milestoneTotal;

  // ==========================================
  // STEP 1 → STEP 2
  // ==========================================

  const continueToMilestones = (event) => {
    event.preventDefault();

    if (!formData.worker) {
      return;
    }

    if (!formData.arbiter) {
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      return;
    }

    if (!formData.deadline) {
      return;
    }

    setEscrowStep(2);
  };

  // ==========================================
  // STEP 2 → STEP 3
  // ==========================================

  const continueToReview = (event) => {
    event.preventDefault();

    if (!amountMatchesMilestones) {
      return;
    }

    setEscrowStep(3);
  };

  // ==========================================
  // GO BACK
  // ==========================================

  const goBack = () => {
    setEscrowStep((previous) => Math.max(1, previous - 1));
  };

  // ==========================================
  // XLM → STROOPS
  // ==========================================

  const xlmToStroops = (value) => {
    const stringValue = String(value).trim();

    const [whole, fraction = ""] = stringValue.split(".");

    if (fraction.length > 7) {
      throw new Error("XLM amount can have at most 7 decimal places.");
    }

    const paddedFraction = (fraction + "0000000").slice(0, 7);

    return (
      BigInt(whole || "0") * 10000000n +
      BigInt(paddedFraction || "0")
    ).toString();
  };

  // ==========================================
  // STROOPS → XLM
  // ==========================================

  const stroopsToXlm = (value) => {
    const stroops = BigInt(String(value || "0"));

    const whole = stroops / 10000000n;

    const fraction = stroops % 10000000n;

    if (fraction === 0n) {
      return Number(whole);
    }

    return Number(`${whole}.${fraction.toString().padStart(7, "0")}`);
  };

  // ==========================================
  // SUBMIT SIGNED TRANSACTION
  // ==========================================

  const submitTransaction = async (signedTxXdr) => {
    const response = await fetch(STELLAR_RPC_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),

        method: "sendTransaction",

        params: {
          transaction: signedTxXdr,
        },
      }),
    });

    const result = await response.json();

    console.log("Stellar sendTransaction response:", result);

    if (!response.ok) {
      throw new Error("Could not submit transaction to Stellar.");
    }

    if (result.error) {
      console.log("STELLAR RPC ERROR:", result.error);

      throw new Error(
        result.error.message || "Stellar rejected the transaction.",
      );
    }

    if (!result.result) {
      throw new Error("Stellar did not return a transaction result.");
    }

    if (result.result.status !== "PENDING") {
      console.log("FULL STELLAR ERROR:", result.result);
      console.log("FULL STELLAR RESPONSE:", JSON.stringify(result, null, 2));

      throw new Error(
        `Transaction was not accepted.

Status: ${result.result.status}

Error XDR: ${result.result.errorResultXdr || "Not provided"}

Full response:
${JSON.stringify(result, null, 2)}`,
      );
    }

    return result.result;
  };

  // ==========================================
  // GET TRANSACTION STATUS
  // ==========================================

  const getTransactionStatus = async (transactionHash) => {
    const response = await fetch(STELLAR_RPC_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),

        method: "getTransaction",

        params: {
          hash: transactionHash,
        },
      }),
    });

    const result = await response.json();

    console.log("Stellar getTransaction response:", result);

    if (result.error) {
      throw new Error(
        result.error.message || "Could not check transaction status.",
      );
    }

    return result.result;
  };

  // ==========================================
  // WAIT FOR CONFIRMATION
  // ==========================================

  const waitForConfirmation = async (transactionHash) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = await getTransactionStatus(transactionHash);

      console.log(`Transaction check ${attempt + 1}:`, result);

      if (!result) {
        continue;
      }

      if (result.status === "SUCCESS") {
        return result;
      }

      if (result.status === "FAILED") {
        throw new Error("The escrow transaction failed on Stellar.");
      }
    }

    throw new Error(
      "Transaction was submitted, but confirmation is taking too long.",
    );
  };

  // ==========================================
  // CREATE ESCROW
  // ==========================================

  const handleCreateEscrow = async () => {
    try {
      setCreatingEscrow(true);

      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!formData.worker) {
        throw new Error("Worker wallet is required.");
      }

      if (!formData.arbiter) {
        throw new Error("Arbiter wallet is required.");
      }

      if (!formData.amount || Number(formData.amount) <= 0) {
        throw new Error("Please enter a valid escrow amount.");
      }

      if (!formData.deadline) {
        throw new Error("Please select a deadline.");
      }

      if (milestones.length === 0) {
        throw new Error("Please add at least one milestone.");
      }

      if (!amountMatchesMilestones) {
        throw new Error("Milestone total must equal the escrow amount.");
      }

      const deadlineUnix = Math.floor(
        new Date(formData.deadline).getTime() / 1000,
      );

      if (deadlineUnix <= Math.floor(Date.now() / 1000)) {
        throw new Error("The deadline must be in the future.");
      }

      // ==========================================
      // PREPARE PAYLOAD
      // ==========================================

      const payload = {
        payer: walletAddress,

        worker: formData.worker,

        arbiter: formData.arbiter,

        token: XLM_SAC,

        amount: xlmToStroops(formData.amount),

        deadline: deadlineUnix.toString(),

        milestones: milestones.map((milestone) => ({
          id: milestone.id,

          amount: xlmToStroops(milestone.amount),

          status: "Pending",
        })),
      };

      console.log("1. Sending escrow data to backend:");

      console.log(payload);

      // ==========================================
      // BACKEND PREPARES TRANSACTION
      // ==========================================

      const response = await fetch(`${API_URL}/api/escrows`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      });

      const result = await response.json();

      console.log("2. Backend response:");

      console.log(result);

      if (!response.ok) {
        throw new Error(
          result.error || "Backend could not prepare the transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      console.log("3. Transaction XDR received:");

      console.log(xdr);

      // ==========================================
      // WALLET SIGNS TRANSACTION
      // ==========================================

      console.log("4. Asking wallet to sign transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,

        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("5. Transaction signed successfully.");

      // ==========================================
      // SEND TO STELLAR
      // ==========================================

      console.log("6. Sending signed transaction to Stellar...");

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("7. Stellar accepted transaction:", transactionResult);

      if (transactionResult.status !== "PENDING") {
        throw new Error(
          `Transaction was not accepted. Status: ${transactionResult.status}`,
        );
      }

      const transactionHash = transactionResult.hash;

      console.log("8. Transaction submitted!");

      console.log("Transaction hash:", transactionHash);

      // ==========================================
      // WAIT FOR CONFIRMATION
      // ==========================================

      console.log("9. Waiting for Stellar confirmation...");

      const finalResult = await waitForConfirmation(transactionHash);

      console.log("10. ESCROW CREATED SUCCESSFULLY!");

      console.log("Transaction hash:", transactionHash);

      console.log("Final result:", finalResult);

      // ==========================================
      // REFRESH ESCROWS
      // ==========================================

      console.log("11. Refreshing escrow list...");

      await loadEscrows(walletAddress);

      // ==========================================
      // RESET FORM
      // ==========================================

      closeCreateEscrow();

      setFormData({
        worker: "",
        arbiter: "",
        amount: "",
        deadline: "",
      });

      setMilestones([
        {
          id: 1,
          amount: "",
        },
      ]);

      showNotification(
        "Your escrow was created successfully.",
        "success",
        "Escrow created",
      );
    } catch (error) {
      console.error("Create escrow error:", error);

      showNotification(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the escrow.",
        "error",
        "Escrow creation failed",
      );
    } finally {
      setCreatingEscrow(false);
    }
  };

  // ==========================================
  // NOTIFICATION
  // ==========================================

  const showNotification = (message, type = "success", title = "") => {
    setNotification({
      message,
      type,
      title,
    });

    window.setTimeout(() => {
      setNotification(null);
    }, 3500);
  };

  // ==========================================
  // SHORTEN ADDRESS
  // ==========================================

  const shortenAddress = (address) => {
    if (!address) {
      return "";
    }

    if (address.length <= 16) {
      return address;
    }

    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  // ==========================================
  // ESCROW PROGRESS
  // ==========================================

  const getEscrowProgress = (escrow) => {
    const escrowMilestones = escrow.milestones || [];

    if (escrowMilestones.length === 0) {
      return {
        completed: 0,
        total: 0,
        percentage: 0,
      };
    }

    const completed = escrowMilestones.filter(
      (milestone) => milestone.status?.tag === "Released",
    ).length;

    const total = escrowMilestones.length;

    const percentage = (completed / total) * 100;

    return {
      completed,
      total,
      percentage,
    };
  };

  // ==========================================
  // DYNAMIC STATS
  // ==========================================

  const totalEscrows = escrows.length;

  const activeEscrows = escrows.filter(
    (escrow) => escrow.status?.tag === "Active",
  ).length;

  const completedEscrows = escrows.filter(
    (escrow) => escrow.status?.tag === "Released",
  ).length;

  const lockedFunds = escrows
    .filter((escrow) => escrow.status?.tag === "Active")
    .reduce(
      (total, escrow) => total + stroopsToXlm(escrow.remaining_amount || 0),
      0,
    );

  const completionRate =
    totalEscrows > 0 ? Math.round((completedEscrows / totalEscrows) * 100) : 0;

  // ==========================================
  // COPY CONTRACT ADDRESS
  // ==========================================

  const copyContractAddress = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ID);

      showNotification(
        "Contract address copied to clipboard.",
        "success",
        "Copied",
      );
    } catch (error) {
      console.error("Could not copy address:", error);
    }
  };

  // ==========================================
  // ESCROW DETAILS
  // ==========================================

  const openEscrowDetails = (escrow) => {
    setSelectedEscrow(escrow);
  };

  const closeEscrowDetails = () => {
    setSelectedEscrow(null);
  };

  // ==========================================
  // RELEASE MILESTONE
  // ==========================================

  const handleReleaseMilestone = async (escrowId, milestoneId) => {
    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!selectedEscrow) {
        throw new Error("No escrow selected.");
      }

      if (selectedEscrow.payer !== walletAddress) {
        throw new Error("Only the payer can release a milestone.");
      }

      setReleasingMilestone(milestoneId);

      console.log("Releasing milestone...");
      console.log("Escrow ID:", escrowId);
      console.log("Milestone ID:", milestoneId);

      // ==========================================
      // BACKEND PREPARES TRANSACTION
      // ==========================================

      const response = await fetch(
        `${API_URL}/api/escrows/${escrowId}/release-milestone`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            milestoneId,
            publicKey: walletAddress,
          }),
        },
      );

      const result = await response.json();

      console.log("Backend release response:", result);

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Backend could not prepare the release transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      // ==========================================
      // WALLET SIGNS TRANSACTION
      // ==========================================

      console.log("Asking wallet to sign release transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,
        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("Release transaction signed successfully.");

      // ==========================================
      // SEND TO STELLAR
      // ==========================================

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("Release transaction submitted:", transactionResult);

      const transactionHash = transactionResult.hash;

      // ==========================================
      // WAIT FOR CONFIRMATION
      // ==========================================

      console.log("Waiting for release confirmation...");

      const finalResult = await waitForConfirmation(transactionHash);

      console.log("MILESTONE RELEASED SUCCESSFULLY!");

      console.log("Transaction hash:", transactionHash);

      console.log("Final result:", finalResult);

      // ==========================================
      // REFRESH ESCROWS
      // ==========================================

      await loadEscrows(walletAddress);

      // Close details modal
      closeEscrowDetails();

      showNotification(
        "The milestone was released successfully.",
        "success",
        "Milestone released",
      );
    } catch (error) {
      console.error("Release milestone error:", error);

      showNotification(
        error instanceof Error
          ? error.message
          : "Something went wrong while releasing the milestone.",
        "error",
        "Milestone release failed",
      );
    } finally {
      setReleasingMilestone(null);
    }
  };

  // ==========================================
  // OPEN DISPUTE
  // ==========================================

  const handleResolveDispute = async (escrowId, winner) => {
    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!selectedEscrow) {
        throw new Error("No escrow selected.");
      }

      if (selectedEscrow.arbiter !== walletAddress) {
        throw new Error("Only the arbiter can resolve this dispute.");
      }

      if (selectedEscrow.status?.tag !== "Disputed") {
        throw new Error("Only a disputed escrow can be resolved.");
      }

      setResolvingDispute(true);

      console.log("Resolving dispute...");
      console.log("Escrow ID:", escrowId);
      console.log("Winner:", winner);

      const response = await fetch(
        `${API_URL}/api/escrows/${escrowId}/resolve-dispute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicKey: walletAddress,
            winner,
          }),
        },
      );

      const result = await response.json();

      console.log("Backend resolve dispute response:", result);

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Backend could not prepare the resolution transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      console.log("Asking arbiter wallet to sign resolution transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,
        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("Resolution transaction signed successfully.");

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("Resolution transaction submitted:", transactionResult);

      const hash = transactionResult.hash;

      if (!hash) {
        throw new Error("Stellar did not return a transaction hash.");
      }

      console.log("Waiting for resolution confirmation...");

      const finalResult = await waitForConfirmation(hash);

      console.log("DISPUTE RESOLVED SUCCESSFULLY!");
      console.log("Transaction hash:", hash);

      await loadEscrows(walletAddress);

      setSelectedEscrow(null);

      showNotification(
        `Dispute resolved. ${winner === "Worker" ? "Worker" : "Payer"} received the remaining funds.`,
        "success",
        "Dispute resolved",
      );
    } catch (error) {
      console.error("Resolve dispute failed:", error);

      showNotification(
        error instanceof Error ? error.message : "Could not resolve dispute.",
        "error",
        "Dispute resolution failed",
      );
    } finally {
      setResolvingDispute(false);
    }
  };

  const handleOpenDispute = async (escrowId) => {
    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!selectedEscrow) {
        throw new Error("No escrow selected.");
      }

      if (selectedEscrow.payer !== walletAddress) {
        throw new Error("Only the payer can open a dispute.");
      }

      if (selectedEscrow.status?.tag !== "Active") {
        throw new Error("Only an active escrow can be disputed.");
      }

      if (Number(selectedEscrow.remaining_amount || 0) <= 0) {
        throw new Error("There are no remaining funds to dispute.");
      }

      setOpeningDispute(true);

      console.log("Opening dispute...");
      console.log("Escrow ID:", escrowId);

      // ==========================================
      // BACKEND PREPARES TRANSACTION
      // ==========================================

      const response = await fetch(
        `${API_URL}/api/escrows/${escrowId}/open-dispute`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            publicKey: walletAddress,
          }),
        },
      );

      const result = await response.json();

      console.log("Backend open dispute response:", result);

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Backend could not prepare the dispute transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      // ==========================================
      // WALLET SIGNS TRANSACTION
      // ==========================================

      console.log("Asking wallet to sign dispute transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,
        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("Dispute transaction signed successfully.");

      // ==========================================
      // SEND TO STELLAR
      // ==========================================

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("Dispute transaction submitted:", transactionResult);

      const transactionHash = transactionResult.hash;

      // ==========================================
      // WAIT FOR CONFIRMATION
      // ==========================================

      console.log("Waiting for dispute confirmation...");

      const finalResult = await waitForConfirmation(transactionHash);

      console.log("DISPUTE OPENED SUCCESSFULLY!");

      console.log("Transaction hash:", transactionHash);

      console.log("Final result:", finalResult);

      // ==========================================
      // REFRESH ESCROWS
      // ==========================================

      await loadEscrows(walletAddress);

      // Close details modal
      closeEscrowDetails();

      showNotification(
        "The dispute was opened successfully.",
        "success",
        "Dispute opened",
      );
    } catch (error) {
      console.error("Open dispute error:", error);

      showNotification(
        error instanceof Error
          ? error.message
          : "Something went wrong while opening the dispute.",
        "error",
        "Dispute failed",
      );
    } finally {
      setOpeningDispute(false);
    }
  };

  // ==========================================
  // CANCEL ESCROW
  // ==========================================

  const handleCancelEscrow = async (escrowId) => {
    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!selectedEscrow) {
        throw new Error("No escrow selected.");
      }

      if (selectedEscrow.payer !== walletAddress) {
        throw new Error("Only the payer can cancel this escrow.");
      }

      if (selectedEscrow.status?.tag !== "Active") {
        throw new Error("Only an active escrow can be cancelled.");
      }

      if (Number(selectedEscrow.remaining_amount || 0) <= 0) {
        throw new Error("There are no remaining funds to cancel.");
      }

      setCancellingEscrow(true);

      console.log("Cancelling escrow...");
      console.log("Escrow ID:", escrowId);

      // ==========================================
      // BACKEND PREPARES TRANSACTION
      // ==========================================

      const response = await fetch(
        `${API_URL}/api/escrows/${escrowId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicKey: walletAddress,
          }),
        },
      );

      const result = await response.json();

      console.log("Backend cancel response:", result);

      if (!response.ok) {
        throw new Error(
          result.message || "Backend could not prepare the cancel transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      // ==========================================
      // WALLET SIGNS TRANSACTION
      // ==========================================

      console.log("Asking payer wallet to sign cancel transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,
        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("Cancel transaction signed successfully.");

      // ==========================================
      // SEND TO STELLAR
      // ==========================================

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("Cancel transaction submitted:", transactionResult);

      const transactionHash = transactionResult.hash;

      if (!transactionHash) {
        throw new Error("Stellar did not return a transaction hash.");
      }

      // ==========================================
      // WAIT FOR CONFIRMATION
      // ==========================================

      console.log("Waiting for cancel confirmation...");

      await waitForConfirmation(transactionHash);

      console.log("ESCROW CANCELLED SUCCESSFULLY!");
      console.log("Transaction hash:", transactionHash);

      // ==========================================
      // REFRESH ESCROWS
      // ==========================================

      await loadEscrows(walletAddress);

      setSelectedEscrow(null);

      showNotification(
        "The escrow was cancelled and the remaining funds were returned to the payer.",
        "success",
        "Escrow cancelled",
      );
    } catch (error) {
      console.error("Cancel escrow error:", error);

      showNotification(
        error instanceof Error
          ? error.message
          : "Something went wrong while cancelling the escrow.",
        "error",
        "Cancel failed",
      );
    } finally {
      setCancellingEscrow(false);
    }
  };

  // ==========================================
  // REFUND ESCROW
  // ==========================================

  const handleRefundEscrow = async (escrowId) => {
    try {
      if (!walletAddress) {
        throw new Error("Please connect your wallet first.");
      }

      if (!selectedEscrow) {
        throw new Error("No escrow selected.");
      }

      if (selectedEscrow.payer !== walletAddress) {
        throw new Error("Only the payer can refund this escrow.");
      }

      if (selectedEscrow.status?.tag !== "Active") {
        throw new Error("Only an active escrow can be refunded.");
      }

      if (Number(selectedEscrow.remaining_amount || 0) <= 0) {
        throw new Error("There are no remaining funds to refund.");
      }

      const deadline = Number(selectedEscrow.deadline || 0);
      const currentTime = Math.floor(Date.now() / 1000);

      if (currentTime < deadline) {
        throw new Error("The escrow deadline has not been reached yet.");
      }

      setRefundingEscrow(true);

      console.log("Refunding escrow...");
      console.log("Escrow ID:", escrowId);

      // ==========================================
      // BACKEND PREPARES TRANSACTION
      // ==========================================

      const response = await fetch(
        `${API_URL}/api/escrows/${escrowId}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicKey: walletAddress,
          }),
        },
      );

      const result = await response.json();

      console.log("Backend refund response:", result);

      if (!response.ok) {
        throw new Error(
          result.message || "Backend could not prepare the refund transaction.",
        );
      }

      const transactionData =
        typeof result?.data === "string"
          ? JSON.parse(result.data)
          : result?.data;

      const xdr = transactionData?.tx;

      if (!xdr) {
        throw new Error("Backend did not return a transaction XDR.");
      }

      // ==========================================
      // WALLET SIGNS TRANSACTION
      // ==========================================

      console.log("Asking payer wallet to sign refund transaction...");

      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        address: walletAddress,
        networkPassphrase: Networks.TESTNET,
      });

      if (!signedTxXdr) {
        throw new Error("Wallet did not return a signed transaction.");
      }

      console.log("Refund transaction signed successfully.");

      // ==========================================
      // SEND TO STELLAR
      // ==========================================

      const transactionResult = await submitTransaction(signedTxXdr);

      console.log("Refund transaction submitted:", transactionResult);

      const transactionHash = transactionResult.hash;

      if (!transactionHash) {
        throw new Error("Stellar did not return a transaction hash.");
      }

      // ==========================================
      // WAIT FOR CONFIRMATION
      // ==========================================

      console.log("Waiting for refund confirmation...");

      const finalResult = await waitForConfirmation(transactionHash);

      console.log("ESCROW REFUNDED SUCCESSFULLY!");
      console.log("Transaction hash:", transactionHash);
      console.log("Final result:", finalResult);

      await loadEscrows(walletAddress);

      closeEscrowDetails();

      showNotification(
        "The escrow funds were refunded successfully.",
        "success",
        "Escrow refunded",
      );
    } catch (error) {
      console.error("Refund escrow error:", error);

      showNotification(
        error instanceof Error
          ? error.message
          : "Something went wrong while refunding the escrow.",
        "error",
        "Refund failed",
      );
    } finally {
      setRefundingEscrow(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <>
      <style>{`
        .wallet-menu-wrapper {
          position: relative;
        }

        .wallet-button {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .wallet-button-content {
          min-width: 0;
        }

        .wallet-chevron {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 180ms ease;
          color: var(--wallet-muted);
          opacity: 1;
        }

        .wallet-chevron.open {
          transform: rotate(180deg);
        }

        .wallet-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 290px;
          padding: 12px;
          border: 1px solid var(--wallet-border);
          border-radius: 16px;
          background: var(--wallet-bg);
          color: var(--wallet-text);
          box-shadow: var(--wallet-shadow);
          z-index: 1000;
          animation: walletDropdownIn 160ms ease-out;
        }

        html[data-theme="dark"] {
          --wallet-bg: #111827;
          --wallet-surface: #1a2130;
          --wallet-icon-bg: #20283a;
          --wallet-border: rgba(148, 163, 184, 0.22);
          --wallet-divider: rgba(148, 163, 184, 0.14);
          --wallet-text: #f1f5f9;
          --wallet-muted: #94a3b8;
          --wallet-accent: #8b7cff;
          --wallet-shadow: 0 20px 45px rgba(0, 0, 0, 0.28);
        }

        html[data-theme="light"] {
          --wallet-bg: #ffffff;
          --wallet-surface: #f8f9fd;
          --wallet-icon-bg: #f0efff;
          --wallet-border: rgba(71, 63, 156, 0.16);
          --wallet-divider: rgba(71, 63, 156, 0.10);
          --wallet-text: #202235;
          --wallet-muted: #73778a;
          --wallet-accent: #5b50d6;
          --wallet-shadow: 0 18px 40px rgba(39, 35, 86, 0.14);
        }

        .wallet-dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 4px 10px;
        }

        .wallet-dropdown-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--wallet-muted);
          opacity: 1;
        }

        .wallet-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 600;
          opacity: 0.75;
        }

        .wallet-status-badge span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
        }

        .wallet-address-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border-radius: 12px;
          background: var(--wallet-surface);
        }

        .wallet-address-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 10px;
          background: var(--wallet-icon-bg);
          color: var(--wallet-accent);
          opacity: 1;
        }

        .wallet-address-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .wallet-address-text span {
          font-size: 10px;
          color: var(--wallet-muted);
          opacity: 1;
        }

        .wallet-address-text strong {
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wallet-dropdown-divider {
          height: 1px;
          margin: 10px 2px;
          background: var(--wallet-divider);
        }

        .wallet-disconnect-button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 11px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--wallet-text);
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          text-align: left;
          transition: background 150ms ease, transform 150ms ease;
        }

        .wallet-disconnect-button:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #dc2626;
          transform: translateX(2px);
        }

        .disconnect-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.78;
        }

        @keyframes walletDropdownIn {
          from {
            opacity: 0;
            transform: translateY(-5px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 600px) {
          .wallet-dropdown {
            right: -8px;
            width: min(290px, calc(100vw - 32px));
          }
        }
      `}</style>
      <div className="app">
        {/* ==========================================
          SIDEBAR
          ========================================== */}

        <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-icon">S</div>

            <div>
              <span className="brand-name">StellarChain</span>

              <span className="brand-subtitle">ESCROW PROTOCOL</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-label">MAIN MENU</div>

            {navItems.map((item) => (
              <button
                key={item}
                className={`sidebar-link ${activePage === item ? "active" : ""}`}
                onClick={() => handleNavigation(item)}
              >
                <span className="nav-icon">
                  {item === "Dashboard" && "▦"}

                  {item === "Escrows" && "◇"}

                  {item === "Activity" && "◷"}
                </span>

                <span>{item}</span>

                {item === "Escrows" && (
                  <span className="nav-count">{totalEscrows}</span>
                )}
              </button>
            ))}

            <div className="nav-label second-label">NETWORK</div>

            <div className="network-status">
              <span className="online-dot"></span>

              <div>
                <strong>Stellar Testnet</strong>

                <small>Connected</small>
              </div>
            </div>
          </nav>

          <div className="sidebar-bottom">
            <div className="contact-box">
              <div className="contact-box-header">
                <div className="contact-avatar">
                  <img src={mosesPhoto} alt="Moses Ifunanya Nobei" />
                </div>
                <div>
                  <span className="contact-label">CONTACT</span>
                  <strong>Moses Ifunanya Nobei</strong>
                  <span>Blockchain Developer</span>
                </div>
              </div>

              <div className="contact-socials">
                <a
                  href="https://x.com/Ifynob53"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X"
                  title="X"
                >
                  <span className="contact-social-icon x-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.24-8.28L2.8 2h6.4l4.42 5.84L18.9 2Zm-1.1 17.85h1.73L8.27 4.03H6.41L17.8 19.85Z" />
                    </svg>
                  </span>
                  <span className="contact-social-label">X</span>
                </a>

                <a
                  href="https://www.linkedin.com/in/mosesifunanya/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  title="LinkedIn"
                >
                  <span className="contact-social-icon linkedin-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A2.01 2.01 0 1 0 5.25 7a2.01 2.01 0 0 0 0-4ZM20.44 13.41c0-3.47-1.85-5.09-4.32-5.09-1.99 0-2.88 1.09-3.38 1.86V8.5H9.36V20h3.38v-6.4c0-1.69.32-3.33 2.42-3.33 2.06 0 2.09 1.94 2.09 3.44V20h3.19v-6.59Z" />
                    </svg>
                  </span>
                  <span className="contact-social-label">LinkedIn</span>
                </a>

                <a
                  href="https://github.com/mosesifunanya"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  title="GitHub"
                >
                  <span className="contact-social-icon github-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.12c-3.13.68-3.79-1.5-3.79-1.5-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.62 1.22 3.26.93.1-.72.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.58 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16a10.8 10.8 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.61 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.34-2.63 5.3-5.14 5.58.4.35.75 1.05.75 2.12v3.15c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
                    </svg>
                  </span>
                  <span className="contact-social-label">GitHub</span>
                </a>

                <a
                  href="mailto:mosesifunanya@gmail.com"
                  aria-label="Email"
                  title="Email"
                >
                  <span className="contact-social-icon email-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <span className="contact-social-label">Email</span>
                </a>
              </div>
            </div>

            <div className="sidebar-footer">
              <span>StellarChain</span>
              <span>v1.0.0</span>
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}

        {menuOpen && (
          <div
            className="mobile-overlay"
            onClick={() => setMenuOpen(false)}
          ></div>
        )}

        {/* ==========================================
          MAIN AREA
          ========================================== */}

        <div className="main-area">
          {/* TOPBAR */}

          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>

              <div className="breadcrumb">
                <span>StellarChain</span>

                <span>/</span>

                <strong>{activePage}</strong>
              </div>
            </div>

            <div className="topbar-right">
              <button
                className="theme-toggle"
                onClick={toggleTheme}
                title="Toggle theme"
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>

              <div className="network-pill">
                <span></span>
                Testnet
              </div>

              <div className="wallet-menu-wrapper">
                <button
                  className={`wallet-button ${walletAddress ? "wallet-connected" : ""}`}
                  onClick={() => {
                    if (walletAddress) {
                      setWalletMenuOpen((previous) => !previous);
                    } else {
                      connectWallet();
                    }
                  }}
                  disabled={connecting}
                  aria-haspopup={walletAddress ? "menu" : undefined}
                  aria-expanded={walletAddress ? walletMenuOpen : undefined}
                >
                  <span className="wallet-dot"></span>

                  <span className="wallet-button-content">
                    {connecting
                      ? "Connecting..."
                      : walletAddress
                        ? shortenAddress(walletAddress)
                        : "Connect Wallet"}
                  </span>

                  <span
                    className={`wallet-chevron ${walletMenuOpen ? "open" : ""}`}
                    aria-hidden="true"
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                {walletAddress && walletMenuOpen && (
                  <div className="wallet-dropdown" role="menu">
                    <div className="wallet-dropdown-header">
                      <span className="wallet-dropdown-label">
                        CONNECTED WALLET
                      </span>
                      <span className="wallet-status-badge">
                        <span></span> Connected
                      </span>
                    </div>

                    <div className="wallet-address-card">
                      <div className="wallet-address-icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4 7.5C4 6.11929 5.11929 5 6.5 5H19C20.1046 5 21 5.89543 21 7V17C21 18.1046 20.1046 19 19 19H6.5C5.11929 19 4 17.8807 4 16.5V7.5Z"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M4 8H19"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <circle
                            cx="17"
                            cy="13.5"
                            r="1.5"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="wallet-address-text">
                        <span>Stellar address</span>
                        <strong>{shortenAddress(walletAddress)}</strong>
                      </div>
                    </div>

                    <div className="wallet-dropdown-divider"></div>

                    <button
                      className="wallet-disconnect-button"
                      onClick={disconnectWallet}
                      role="menuitem"
                    >
                      <span className="disconnect-icon">
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M10 17L15 12L10 7"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15 12H4"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          <path
                            d="M14 4H19C19.5523 4 20 4.44772 20 5V19C20 19.5523 19.5523 20 19 20H14"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <span>Disconnect Wallet</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ==========================================
            DASHBOARD
            ========================================== */}

          <main className="dashboard">
            <section className="dashboard-heading">
              <div>
                <div className="eyebrow">OVERVIEW</div>

                <h1>Dashboard</h1>

                <p>Manage your escrow agreements and track your payments.</p>
              </div>

              <button
                className="create-escrow-button"
                onClick={openCreateEscrow}
              >
                <span>+</span>
                Create Escrow
              </button>
            </section>

            {/* ==========================================
              STATS
              ========================================== */}

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">TOTAL ESCROWS</span>

                  <div className="stat-icon">◇</div>
                </div>

                <div className="stat-value">{totalEscrows}</div>

                <div className="stat-bottom">
                  <span className="neutral">Your escrows</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">LOCKED FUNDS</span>

                  <div className="stat-icon">◈</div>
                </div>

                <div className="stat-value">
                  {lockedFunds.toLocaleString(undefined, {
                    maximumFractionDigits: 7,
                  })}

                  <small> XLM</small>
                </div>

                <div className="stat-bottom">
                  <span className="neutral">Currently locked</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">ACTIVE ESCROWS</span>

                  <div className="stat-icon">◷</div>
                </div>

                <div className="stat-value">{activeEscrows}</div>

                <div className="stat-bottom">
                  <span className="neutral">Currently active</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">COMPLETED</span>

                  <div className="stat-icon">✓</div>
                </div>

                <div className="stat-value">{completedEscrows}</div>

                <div className="stat-bottom">
                  <span className="positive">{completionRate}%</span>

                  <span>completion rate</span>
                </div>
              </div>
            </section>

            {/* ==========================================
              CONTENT GRID
              ========================================== */}

            <section className="content-grid">
              {/* ESCROWS */}

              <div className="panel escrow-panel">
                <div className="panel-header">
                  <div>
                    <h2>Your Escrows</h2>

                    <p>Your latest escrow agreements</p>
                  </div>

                  <button
                    className="view-all"
                    onClick={() => handleNavigation("Escrows")}
                  >
                    View all →
                  </button>
                </div>

                <div className="escrow-list">
                  {!walletAddress && (
                    <div className="empty-state">
                      <h3>Connect your wallet</h3>

                      <p>Connect your Stellar wallet to see your escrows.</p>
                    </div>
                  )}

                  {walletAddress && loadingEscrows && (
                    <div className="empty-state">
                      <h3>Loading escrows...</h3>

                      <p>Reading your escrows from Stellar.</p>
                    </div>
                  )}

                  {walletAddress && !loadingEscrows && escrows.length === 0 && (
                    <div className="empty-state">
                      <h3>No escrows yet</h3>

                      <p>Create your first escrow agreement.</p>
                    </div>
                  )}

                  {escrows.map((escrow) => {
                    const progress = getEscrowProgress(escrow);

                    const status = escrow.status?.tag || "Unknown";

                    const amount = stroopsToXlm(escrow.amount || 0);

                    return (
                      <div
                        className="escrow-row"
                        key={escrow.id}
                        onClick={() => openEscrowDetails(escrow)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="escrow-project">
                          <div className="project-icon purple">E</div>

                          <div>
                            <h3>Escrow Agreement</h3>

                            <span>Escrow #{escrow.id}</span>
                          </div>
                        </div>

                        <div className="escrow-worker">
                          <span className="column-label">WORKER</span>

                          <strong>{shortenAddress(escrow.worker)}</strong>
                        </div>

                        <div className="escrow-amount">
                          <span className="column-label">AMOUNT</span>

                          <strong>{amount} XLM</strong>
                        </div>

                        <div className="escrow-progress">
                          <span className="column-label">PROGRESS</span>

                          <div className="progress-wrapper">
                            <div className="progress-bar">
                              <div
                                className={`progress-fill ${
                                  progress.percentage === 100 ? "complete" : ""
                                }`}
                                style={{
                                  width: `${progress.percentage}%`,
                                }}
                              ></div>
                            </div>

                            <span>
                              {progress.completed}/{progress.total}
                            </span>
                          </div>
                        </div>

                        <div className="escrow-status">
                          <span
                            className={`status ${
                              status === "Released"
                                ? "completed-status"
                                : "active-status"
                            }`}
                          >
                            {status === "Released" ? "Completed" : status}
                          </span>
                        </div>

                        <button className="row-arrow">→</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVITY */}

              <div className="panel activity-panel">
                <div className="panel-header">
                  <div>
                    <h2>Recent Activity</h2>

                    <p>Latest escrow activity</p>
                  </div>

                  <button className="more-button">•••</button>
                </div>

                <div className="activity-list">
                  {escrows.length === 0 && (
                    <div className="empty-state">
                      <h3>No activity</h3>

                      <p>Your escrow activity will appear here.</p>
                    </div>
                  )}

                  {escrows
                    .slice()
                    .reverse()
                    .slice(0, 4)
                    .map((escrow) => {
                      const status = escrow.status?.tag || "Active";

                      const amount = stroopsToXlm(escrow.amount || 0);

                      const completed = status === "Released";

                      return (
                        <div className="activity-item" key={escrow.id}>
                          <div
                            className={`activity-icon ${
                              completed ? "success" : "created"
                            }`}
                          >
                            {completed ? "✓" : "+"}
                          </div>

                          <div className="activity-content">
                            <strong>
                              {completed
                                ? "Escrow completed"
                                : "Escrow created"}
                            </strong>

                            <span>Escrow #{escrow.id}</span>
                          </div>

                          <div className="activity-amount">
                            <strong>{amount} XLM</strong>

                            <span>Testnet</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

            {/* ==========================================
              BOTTOM
              ========================================== */}

            <section className="bottom-grid">
              <div className="quick-card">
                <div className="quick-icon">+</div>

                <div>
                  <h3>Create a new escrow</h3>

                  <p>Lock funds securely and define your payment milestones.</p>
                </div>

                <button onClick={openCreateEscrow}>Start →</button>
              </div>

              <div className="contract-card">
                <div className="contract-heading">
                  <div className="contract-icon">S</div>

                  <div>
                    <span>SMART CONTRACT</span>

                    <h3>StellarChain Escrow</h3>
                  </div>
                </div>

                <div className="contract-address">
                  <span>CONTRACT ADDRESS</span>

                  <div>
                    <code>{shortenAddress(CONTRACT_ID)}</code>

                    <button onClick={copyContractAddress}>Copy</button>
                  </div>
                </div>

                <div className="contract-network">
                  <span className="online-dot"></span>
                  Deployed on Stellar Testnet
                </div>
              </div>
            </section>
          </main>
        </div>

        {/* ==========================================
          CREATE ESCROW MODAL
          ========================================== */}

        {showCreateEscrow && (
          <div className="escrow-modal-overlay" onClick={closeCreateEscrow}>
            <div
              className="escrow-modal"
              onClick={(event) => event.stopPropagation()}
            >
              {/* MODAL TOP */}

              <div className="escrow-modal-top">
                <div>
                  <div className="modal-eyebrow">NEW AGREEMENT</div>

                  <h2>Create escrow</h2>

                  <p>Set up a secure payment agreement on Stellar.</p>
                </div>

                <button
                  className="modal-close"
                  onClick={closeCreateEscrow}
                  aria-label="Close modal"
                  disabled={creatingEscrow}
                >
                  ×
                </button>
              </div>

              {/* STEPPER */}

              <div className="escrow-stepper">
                <div
                  className={`step-item ${escrowStep >= 1 ? "step-active" : ""}`}
                >
                  <div className="step-circle">
                    {escrowStep > 1 ? "✓" : "1"}
                  </div>

                  <div className="step-text">
                    <strong>Details</strong>

                    <span>Agreement</span>
                  </div>
                </div>

                <div
                  className={`step-connector ${
                    escrowStep >= 2 ? "connector-active" : ""
                  }`}
                ></div>

                <div
                  className={`step-item ${escrowStep >= 2 ? "step-active" : ""}`}
                >
                  <div className="step-circle">
                    {escrowStep > 2 ? "✓" : "2"}
                  </div>

                  <div className="step-text">
                    <strong>Milestones</strong>

                    <span>Payments</span>
                  </div>
                </div>

                <div
                  className={`step-connector ${
                    escrowStep >= 3 ? "connector-active" : ""
                  }`}
                ></div>

                <div
                  className={`step-item ${escrowStep >= 3 ? "step-active" : ""}`}
                >
                  <div className="step-circle">3</div>

                  <div className="step-text">
                    <strong>Review</strong>

                    <span>Confirm</span>
                  </div>
                </div>
              </div>

              {/* ==========================================
                STEP 1
                ========================================== */}

              {escrowStep === 1 && (
                <form
                  className="escrow-modal-body"
                  onSubmit={continueToMilestones}
                >
                  <div className="modal-content-title">
                    <div className="content-number">01</div>

                    <div>
                      <h3>Agreement details</h3>

                      <p>
                        Choose the wallets involved in this escrow agreement.
                      </p>
                    </div>
                  </div>

                  <div className="connected-wallet-card">
                    <div className="connected-wallet-icon">✓</div>

                    <div className="connected-wallet-info">
                      <span>PAYING FROM</span>

                      <strong>{shortenAddress(walletAddress)}</strong>
                    </div>

                    <div className="connected-badge">
                      <span></span>
                      Connected
                    </div>
                  </div>

                  <div className="modal-form-group">
                    <label htmlFor="worker">Worker wallet</label>

                    <div className="wallet-input">
                      <div className="wallet-input-icon">G</div>

                      <input
                        id="worker"
                        name="worker"
                        type="text"
                        placeholder="Enter Stellar wallet address"
                        value={formData.worker}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <small>
                      This wallet will receive the milestone payments.
                    </small>
                  </div>

                  <div className="modal-form-group">
                    <label htmlFor="arbiter">Arbiter wallet</label>

                    <div className="wallet-input">
                      <div className="wallet-input-icon">G</div>

                      <input
                        id="arbiter"
                        name="arbiter"
                        type="text"
                        placeholder="Enter Stellar wallet address"
                        value={formData.arbiter}
                        onChange={handleInputChange}
                        required
                      />
                    </div>

                    <small>
                      This wallet can resolve disputes between both parties.
                    </small>
                  </div>

                  <div className="modal-subsection">
                    <div className="modal-content-title">
                      <div className="content-number">02</div>

                      <div>
                        <h3>Payment settings</h3>

                        <p>Set the amount and deadline for this agreement.</p>
                      </div>
                    </div>

                    <div className="payment-fields">
                      <div className="modal-form-group">
                        <label htmlFor="amount">Escrow amount</label>

                        <div className="amount-input-wrapper">
                          <input
                            id="amount"
                            name="amount"
                            type="number"
                            min="0.0000001"
                            step="0.0000001"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={handleInputChange}
                            required
                          />

                          <span>XLM</span>
                        </div>

                        <small>Total amount that will be locked.</small>
                      </div>

                      <div className="modal-form-group">
                        <label htmlFor="deadline">Deadline</label>

                        <input
                          className="modal-date-input"
                          id="deadline"
                          name="deadline"
                          type="datetime-local"
                          value={formData.deadline}
                          onChange={handleInputChange}
                          required
                        />

                        <small>When the escrow can become refundable.</small>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <div className="modal-security-note">
                      <div className="security-icon">🔒</div>

                      <div>
                        <strong>Non-custodial</strong>

                        <p>Your wallet remains in control of your funds.</p>
                      </div>
                    </div>

                    <button type="submit" className="modal-primary-button">
                      Continue
                      <span>→</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ==========================================
                STEP 2
                ========================================== */}

              {escrowStep === 2 && (
                <form className="escrow-modal-body" onSubmit={continueToReview}>
                  <div className="modal-content-title">
                    <div className="content-number">02</div>

                    <div>
                      <h3>Payment milestones</h3>

                      <p>Decide how the escrow funds will be released.</p>
                    </div>
                  </div>

                  <div className="milestone-summary">
                    <div className="summary-item">
                      <span>TOTAL ESCROW</span>

                      <strong>{formData.amount || "0"} XLM</strong>
                    </div>

                    <div className="summary-divider"></div>

                    <div className="summary-item">
                      <span>MILESTONES</span>

                      <strong>{milestones.length}</strong>
                    </div>

                    <div className="summary-divider"></div>

                    <div className="summary-item">
                      <span>ALLOCATED</span>

                      <strong>{milestoneTotal.toFixed(7)} XLM</strong>
                    </div>
                  </div>

                  <div className="milestone-list">
                    {milestones.map((milestone, index) => (
                      <div className="milestone-card" key={milestone.id}>
                        <div className="milestone-number">
                          {String(index + 1).padStart(2, "0")}
                        </div>

                        <div className="milestone-description">
                          <strong>Milestone {index + 1}</strong>

                          <span>Payment released after completion</span>
                        </div>

                        <div className="milestone-amount-input">
                          <input
                            type="number"
                            min="0.0000001"
                            step="0.0000001"
                            placeholder="0.00"
                            value={milestone.amount}
                            onChange={(event) =>
                              handleMilestoneChange(
                                milestone.id,
                                event.target.value,
                              )
                            }
                            required
                          />

                          <span>XLM</span>
                        </div>

                        {milestones.length > 1 && (
                          <button
                            type="button"
                            className="milestone-delete"
                            onClick={() => removeMilestone(milestone.id)}
                            aria-label="Remove milestone"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="add-milestone-button"
                    onClick={addMilestone}
                  >
                    <span>+</span>
                    Add milestone
                  </button>

                  {!amountMatchesMilestones && (
                    <div className="milestone-message warning">
                      <div className="message-icon">!</div>

                      <div>
                        <strong>Milestone total does not match</strong>

                        <p>
                          Allocate exactly {formData.amount || "0"} XLM across
                          your milestones.
                        </p>
                      </div>
                    </div>
                  )}

                  {amountMatchesMilestones && (
                    <div className="milestone-message success">
                      <div className="message-icon">✓</div>

                      <div>
                        <strong>Payment allocation is correct</strong>

                        <p>All {formData.amount} XLM has been allocated.</p>
                      </div>
                    </div>
                  )}

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="modal-back-button"
                      onClick={goBack}
                    >
                      ← Back
                    </button>

                    <button
                      type="submit"
                      className="modal-primary-button"
                      disabled={!amountMatchesMilestones}
                    >
                      Review escrow
                      <span>→</span>
                    </button>
                  </div>
                </form>
              )}

              {/* ==========================================
                STEP 3
                ========================================== */}

              {escrowStep === 3 && (
                <div className="escrow-modal-body">
                  <div className="modal-content-title">
                    <div className="content-number">03</div>

                    <div>
                      <h3>Review escrow</h3>

                      <p>
                        Check the agreement before creating the transaction.
                      </p>
                    </div>
                  </div>

                  <div className="review-card">
                    <div className="review-header">
                      <div>
                        <span>ESCROW AMOUNT</span>

                        <strong>{formData.amount} XLM</strong>
                      </div>

                      <div className="review-ready">
                        <span></span>
                        Ready
                      </div>
                    </div>

                    <div className="review-divider"></div>

                    <div className="review-row">
                      <span>Payer</span>

                      <strong>{shortenAddress(walletAddress)}</strong>
                    </div>

                    <div className="review-row">
                      <span>Worker</span>

                      <strong>{shortenAddress(formData.worker)}</strong>
                    </div>

                    <div className="review-row">
                      <span>Arbiter</span>

                      <strong>{shortenAddress(formData.arbiter)}</strong>
                    </div>

                    <div className="review-row">
                      <span>Deadline</span>

                      <strong>
                        {new Date(formData.deadline).toLocaleString()}
                      </strong>
                    </div>

                    <div className="review-row">
                      <span>Milestones</span>

                      <strong>{milestones.length}</strong>
                    </div>
                  </div>

                  <div className="review-schedule">
                    <div className="review-schedule-title">
                      PAYMENT SCHEDULE
                    </div>

                    {milestones.map((milestone, index) => (
                      <div className="review-schedule-row" key={milestone.id}>
                        <div className="schedule-number">{index + 1}</div>

                        <span>Milestone {index + 1}</span>

                        <strong>{milestone.amount} XLM</strong>
                      </div>
                    ))}
                  </div>

                  <div className="review-security">
                    <div className="review-security-icon">🔐</div>

                    <div>
                      <strong>Your wallet controls the transaction</strong>

                      <p>
                        StellarChain does not hold your private keys. You will
                        review and sign the transaction with your connected
                        wallet.
                      </p>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      type="button"
                      className="modal-back-button"
                      onClick={goBack}
                      disabled={creatingEscrow}
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      className="modal-primary-button"
                      onClick={handleCreateEscrow}
                      disabled={creatingEscrow}
                    >
                      {creatingEscrow ? "Creating..." : "Create escrow"}

                      {!creatingEscrow && <span>→</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
          ESCROW DETAILS MODAL
          ========================================== */}

        {selectedEscrow && (
          <div className="escrow-modal-overlay" onClick={closeEscrowDetails}>
            <div
              className="escrow-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="escrow-modal-top">
                <div>
                  <div className="modal-eyebrow">ESCROW DETAILS</div>

                  <h2>Escrow #{selectedEscrow.id}</h2>

                  <p>View the details of this escrow agreement.</p>
                </div>

                <button
                  className="modal-close"
                  onClick={closeEscrowDetails}
                  aria-label="Close escrow details"
                >
                  ×
                </button>
              </div>

              <div className="escrow-modal-body">
                <div className="review-card">
                  <div className="review-header">
                    <div>
                      <span>ESCROW AMOUNT</span>

                      <strong>
                        {stroopsToXlm(selectedEscrow.amount || 0)} XLM
                      </strong>
                    </div>

                    <div className="review-ready">
                      <span></span>
                      {selectedEscrow.status?.tag || "Unknown"}
                    </div>
                  </div>

                  <div className="review-divider"></div>

                  <div className="review-row">
                    <span>Payer</span>
                    <strong>{shortenAddress(selectedEscrow.payer)}</strong>
                  </div>

                  <div className="review-row">
                    <span>Worker</span>
                    <strong>{shortenAddress(selectedEscrow.worker)}</strong>
                  </div>

                  <div className="review-row">
                    <span>Arbiter</span>
                    <strong>{shortenAddress(selectedEscrow.arbiter)}</strong>
                  </div>

                  <div className="review-row">
                    <span>Remaining funds</span>
                    <strong>
                      {stroopsToXlm(selectedEscrow.remaining_amount || 0)} XLM
                    </strong>
                  </div>

                  <div className="review-row">
                    <span>Deadline</span>
                    <strong>
                      {new Date(
                        Number(selectedEscrow.deadline) * 1000,
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div className="review-row">
                    <span>Milestones</span>
                    <strong>{selectedEscrow.milestones?.length || 0}</strong>
                  </div>
                </div>

                <div className="review-schedule">
                  <div className="review-schedule-title">
                    PAYMENT MILESTONES
                  </div>

                  {selectedEscrow.milestones?.map((milestone, index) => (
                    <div className="review-schedule-row" key={milestone.id}>
                      <div className="schedule-number">{index + 1}</div>

                      <span>Milestone {index + 1}</span>

                      <strong>{stroopsToXlm(milestone.amount)} XLM</strong>

                      <div className="milestone-action-area">
                        {milestone.status?.tag === "Released" ? (
                          <span className="milestone-released-status">
                            <span className="milestone-status-dot"></span>
                            Released
                          </span>
                        ) : (
                          <div className="milestone-pending-group">
                            <span className="milestone-pending-status">
                              <span className="milestone-status-dot"></span>
                              Pending
                            </span>

                            {selectedEscrow.payer === walletAddress &&
                              selectedEscrow.status?.tag === "Active" && (
                                <button
                                  type="button"
                                  className="milestone-release-button"
                                  onClick={() =>
                                    handleReleaseMilestone(
                                      selectedEscrow.id,
                                      milestone.id,
                                    )
                                  }
                                  disabled={releasingMilestone === milestone.id}
                                >
                                  <span className="release-button-icon">➤</span>
                                  {releasingMilestone === milestone.id
                                    ? "Releasing..."
                                    : "Release"}
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-footer">
                  {selectedEscrow.payer === walletAddress &&
                    selectedEscrow.status?.tag === "Active" &&
                    Number(selectedEscrow.remaining_amount || 0) > 0 && (
                      <button
                        type="button"
                        className="open-dispute-button"
                        onClick={() => handleOpenDispute(selectedEscrow.id)}
                        disabled={openingDispute}
                      >
                        {openingDispute ? "Opening dispute..." : "Open Dispute"}
                      </button>
                    )}

                  {selectedEscrow.arbiter === walletAddress &&
                    selectedEscrow.status?.tag === "Disputed" &&
                    Number(selectedEscrow.remaining_amount || 0) > 0 && (
                      <div className="dispute-resolution-actions">
                        <div className="dispute-resolution-label">
                          Resolve dispute
                        </div>

                        <button
                          type="button"
                          className="resolve-worker-button"
                          onClick={() =>
                            handleResolveDispute(selectedEscrow.id, "Worker")
                          }
                          disabled={resolvingDispute}
                        >
                          {resolvingDispute ? "Resolving..." : "Worker Wins"}
                        </button>

                        <button
                          type="button"
                          className="resolve-payer-button"
                          onClick={() =>
                            handleResolveDispute(selectedEscrow.id, "Payer")
                          }
                          disabled={resolvingDispute}
                        >
                          {resolvingDispute ? "Resolving..." : "Payer Wins"}
                        </button>
                      </div>
                    )}

                  {selectedEscrow.payer === walletAddress &&
                    selectedEscrow.status?.tag === "Active" &&
                    Number(selectedEscrow.remaining_amount || 0) > 0 && (
                      <button
                        type="button"
                        className="open-dispute-button"
                        onClick={() => handleCancelEscrow(selectedEscrow.id)}
                        disabled={cancellingEscrow}
                      >
                        {cancellingEscrow ? "Cancelling..." : "Cancel Escrow"}
                      </button>
                    )}

                  {selectedEscrow.payer === walletAddress &&
                    selectedEscrow.status?.tag === "Active" &&
                    Number(selectedEscrow.remaining_amount || 0) > 0 &&
                    Number(selectedEscrow.deadline || 0) <=
                      Math.floor(Date.now() / 1000) && (
                      <button
                        type="button"
                        className="open-dispute-button"
                        onClick={() => handleRefundEscrow(selectedEscrow.id)}
                        disabled={refundingEscrow}
                      >
                        {refundingEscrow ? "Refunding..." : "Refund Escrow"}
                      </button>
                    )}

                  <button
                    type="button"
                    className="modal-back-button"
                    onClick={closeEscrowDetails}
                    disabled={
                      openingDispute ||
                      resolvingDispute ||
                      refundingEscrow ||
                      cancellingEscrow
                    }
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {notification && (
          <div
            className={`app-notification app-notification-${notification.type}`}
            role="status"
            aria-live="polite"
          >
            <div className="app-notification-icon">
              {notification.type === "success"
                ? "✓"
                : notification.type === "error"
                  ? "×"
                  : notification.type === "warning"
                    ? "!"
                    : "i"}
            </div>

            <div className="app-notification-content">
              {notification.title && <strong>{notification.title}</strong>}
              <span>{notification.message}</span>
            </div>

            <button
              type="button"
              className="app-notification-close"
              onClick={() => setNotification(null)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
