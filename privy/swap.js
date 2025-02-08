import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import axios from "axios";
import { API_URLS } from "@raydium-io/raydium-sdk-v2";
import { parseTokenAccountResp } from "@raydium-io/raydium-sdk-v2";

export async function getTokenDecimals(
  mintAddress,
  connectionUrl = "https://api.mainnet-beta.solana.com"
) {
  try {
    // Initialize connection
    const connection = new Connection(connectionUrl);

    // Create PublicKey from mint address string
    const mintPublicKey = new PublicKey(mintAddress);

    // Get mint account info
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey);

    // Check if account exists and is a token mint
    if (
      !mintInfo.value ||
      !mintInfo.value.data ||
      !mintInfo.value.data.parsed
    ) {
      throw new Error("Invalid mint account");
    }

    // Extract decimals from parsed data
    const { decimals } = mintInfo.value.data.parsed.info;
    console.log(decimals);

    return decimals;
  } catch (error) {
    console.error("Error getting token decimals:", error);
    throw error;
  }
}

// getTokenDecimals("Goatm5cqggssKRUwbMnPhHXKtN5SDGEP57qjwTSHD1Xf");

/**
 * @param address solana address
 * @param inputMint mint address
 * @param outputMint mint address
 * @param amount amount to swap no in decimals
 */
export async function swap(address, inputMint, outputMint, amount) {
  try {
    const slippage = 0.5;
    const txVersion = "V0";
    const isV0Tx = txVersion === "V0";

    const [isInputSol, isOutputSol] = [
      inputMint === NATIVE_MINT.toBase58(),
      outputMint === NATIVE_MINT.toBase58(),
    ];

    if (!inputTokenAcc && !isInputSol) {
      console.error("do not have input token account");
      return;
    }

    const { data: swapResponse } = await axios.get(
      `${
        API_URLS.SWAP_HOST
      }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
        slippage * 100
      }&txVersion=${txVersion}`
    );

    if (!swapResponse.success) {
      console.error("Error Getting Swap");
      return;
    }

    const { data: swapTransactions } = await axios.post(
      `${API_URLS.SWAP_HOST}/transaction/swap-base-in`,
      {
        swapResponse,
        txVersion,
        wallet: new PublicKey(address).toBase58(),
        wrapSol: isInputSol,
        unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
        inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
        outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
      }
    );
    const allTxBuf = swapTransactions.data.map((tx) =>
      Buffer.from(tx.transaction, "base64")
    );
    const allTransactions = allTxBuf.map((txBuf) =>
      isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
    );
    return allTransactions;
  } catch (err) {
    console.log(err);
  }
}
