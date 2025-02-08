import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

export async function transfer(from, to, amount, mint = null) {
  const connection = new Connection(clusterApiUrl("mainnet-beta"));

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const transaction = new Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: new PublicKey(from),
  });

  if (mint) {
    const mintPubkey = new PublicKey(mint);
    const fromAta = await getAssociatedTokenAddress(
      mintPubkey,
      new PublicKey(from)
    );

    const toAta = await getAssociatedTokenAddress(
      mintPubkey,
      new PublicKey(to)
    );
    const destinationAccountInfo = await connection.getAccountInfo(toAta);
    if (!destinationAccountInfo) {
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        from,
        toAta,
        to,
        mintPubkey
      );
      transaction.add(createAtaInstruction);
    }
    const transferInstruction = createTransferInstruction(
      fromAta,
      toAta,
      from,
      amount
    );
    transaction.add(transferInstruction);
    return transaction;
  } else {
    const instruction = SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: amount,
    });

    transaction.add(instruction);

    return transaction;
  }
}
