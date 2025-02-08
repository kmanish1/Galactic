async function privysign(id, transaction) {
  const { hash } = await privy.walletApi.solana.signAndSendTransaction({
    walletId: id,
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    transaction: transaction,
  });
  return hash;
}

module.exports = {
  privysign
}