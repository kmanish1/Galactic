import { AccountLayout, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

export async function tokens(addr) {
  const url1 =
    "https://young-convincing-patron.solana-mainnet.quiknode.pro/111587d089e640efa1df6f92fa50d3796756a665";
  const connection = new Connection(url1, {
    commitment: "confirmed",
  });

  if (!addr) {
    return null;
  }

  const tokenAccounts = await connection.getTokenAccountsByOwner(
    new PublicKey(addr),
    {
      programId: TOKEN_PROGRAM_ID,
    }
  );
  //   : Array<{
  //     mintAddress: string,
  //     amount: string,
  //   }>
  const tokens = [];

  for (const tokenAccountInfo of tokenAccounts.value) {
    const accountData = AccountLayout.decode(tokenAccountInfo.account.data);

    const mintAddress = new PublicKey(accountData.mint).toString();
    const amount = accountData.amount;

    // Fetch the mint info to get the decimal places for the token
    const mintInfo = await connection.getParsedAccountInfo(
      new PublicKey(accountData.mint)
    );

    if (mintInfo.value && "parsed" in mintInfo.value.data) {
      const decimals = mintInfo.value.data["parsed"].info.decimals;

      // Exclude tokens with decimals == 0 and amount == 1 (indicative of NFTs)
      if (!(decimals === 0 && amount === BigInt(1))) {
        tokens.push({
          mintAddress,
          amount: amount.toString(),
        });
      }
    }
  }
  //   : Array<{
  //     data: {
  //       address: string,
  //       name: string,
  //       symbol: string,
  //       decimals: number,
  //       logoURI: string,
  //       tags: string[],
  //       extensions: {
  //         coingeckoId: string,
  //       },
  //     },
  //     amount: string,
  //   }>
  const tokenData = [];

  const ignore = [
    // "USDC",
    // "USDT",
    // "mSOL",
    // "JitoSOL",
    // "bSOL",
    // "mrgnLST",
    // "jSOL",
    // "stSOL",
    // "scnSOL",
    // "LST",
    // "ORE",
  ];

  for (const token of tokens) {
    const tokenInfo = await fetch(
      `https://tokens.jup.ag/token/${token.mintAddress}`
    );

    const tokenInfoJson = await tokenInfo.json();

    if (
      tokenInfoJson != null &&
      !ignore.includes(tokenInfoJson.symbol) &&
      token.amount != "0"
    ) {
      tokenData.push({
        data: tokenInfoJson,
        amount: token.amount,
      });
    }
  }
  return tokenData;
}
