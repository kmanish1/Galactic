require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const express = require("express");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");
const { privysign } = require("./privy/privysign");
const { getTokenDecimals, swap } = require("./privy/swap");
const { A } = require("@raydium-io/raydium-sdk-v2/lib/raydium-64d94f53");
const { transfer } = require("./privy/transfer");
const { tokens} = require("./privy/portfolio");

const prisma = new PrismaClient();
const app = express();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const commands = [
  {
    name: "login",
    description: "Initiate Google OAuth and authenticate.",
  },
  {
    name: "wallet",
    description: "Get your wallet and portfolio details",
  },
  {
    name: "transfer",
    description: "Transfer tokens.",
    options: [
      {
        name: "token_address",
        description: "The address of the token to transfer.",
        type: 3,
        required: true,
      },
      {
        name: "quantity",
        description: "The amount of tokens to transfer.",
        type: 10,
        required: true,
      },
      {
        name: "recipient",
        description: "The recipient address.",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "swap",
    description: "Swap Tokens",
    options: [
      {
        name: "input_mint",
        description: "The address of the token to swap.",
        type: 3,
        required: true,
      },
      {
        name: "output_mint",
        description: "The address of the token to which you want to swap",
        type: 10,
        required: true,
      },
      {
        name: "quantity",
        description: "The amount of tokens to transfer.",
        type: 3,
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN
);
(async () => {
  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
      body: commands,
    });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user } = interaction;
  const discordId = user.id;

  try {
    switch (commandName) {
      // case "walletaddress":
      //   const walletUser = await prisma.user.findUnique({
      //     where: { discordId },
      //   });

      //   if (!walletUser || !walletUser.auth_token) {
      //     return interaction.reply({
      //       content: "Please log in first using `/login`.",
      //       ephemeral: true,
      //     });
      //   }
      //   await interaction.reply({
      //     content: `Your wallets:${walletUser.solAddress}`,
      //     ephemeral: true,
      //   });
      //   break;

      case "login":
        const createWalletUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!createWalletUser) {
          try {
            const { id, address, chainType } = await privy.walletApi.create({
              chainType: "solana",
            });
            await prisma.user.update({
              where: { discordId },
              data: {
                privyId: id,
                solAddress: address,
              },
            });
            await interaction.reply({
              content: `Wallet created successfully: ${address}`,
              ephemeral: true,
            });
          } catch (error) {
            console.error("Error creating wallet:", error);
            await interaction.reply({
              content: `Error creating wallet: ${error.message}`,
              ephemeral: true,
            });
          }
          break;
        } else {
          const addr = createWalletUser.solAddress;
          await interaction.reply({
            content: `Login Successful. Your address is \`${addr}\`  Topup your wallet with sol to cover gas fee`,
            ephemeral: true,
          });
          break;
        }

      case "wallet":
        const portfolioUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!portfolioUser) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const publicKey = portfolioUser.solAddress;
        const tokens = await tokens(publicKey);
        await interaction.reply({
          content: `Your Wallet Address : ${publicKey} Your portfolio: ${tokens}`,
          ephemeral: true,
        });
        break;
      case "swap":
        const user = await prisma.user.findUnique({
          where: { discordId },
        });
        if (!transferUser || !transferUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const input_mint = options.getString("input_mint");
        const output_mint = options.getString("output_mint");
        const volume = options.getString("quantity");
        const token_decimals = await getTokenDecimals(input_mint);
        const amount = volume * token_decimals;
        const allTransactions = await swap(
          user.solAddress,
          input_mint,
          output_mint,
          amount
        );

        await Promise.all(
          allTransactions.map((_, i) => privysign(user.privyId, i))
        );
      case "transfer":
        const transferUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!transferUser || !transferUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }

        const toAddress = options.getString("recipient");
        const vol = options.getString("quantity");
        const token_address = options.getString("token_address");
        const decimals = await getTokenDecimals(token_address);
        const quantity = vol * decimals;
        const fromAddress = transferUser.solAddress;
        const privyId = transferUser.privyId;
        const transferRes = await transfer(
          fromAddress,
          toAddress,
          quantity,
          token_address
        );

        const sidfsfa = await privysign(privyId, transferRes);
        await interaction.reply({
          content: `Token transfer initiated`,
          ephemeral: true,
        });
        break;

      case "help":
        const helpMessage = `
          Available Commands:
          1. /login - Initiate Google OAuth and authenticate.
          2. /wallets - Get your wallets.
          3. /createwallet - Create a new wallet.
          4. /portfolio - Get your portfolio details.
          5. /refresh_token - Refresh your access token.
          6. /logout - Logout from Okto.
          7. /userdetails - Get your user details.
          8. /networks - Get supported networks.
          9. /tokens - Get supported tokens.
          10. /transfer <network> <token_address> <quantity> <recipient> - Transfer tokens.
          11. /orders - Get your order history.
        `;
        await interaction.reply({
          content: helpMessage,
          ephemeral: true,
        });
        break;

      default:
        await interaction.reply({
          content: "Command not recognized.",
          ephemeral: true,
        });
    }
  } catch (error) {
    if (error.message.includes("not authenticated")) {
      await interaction.reply({
        content: "Please log in first using `/login`.",
        ephemeral: true,
      });
    } else {
      console.error("Error handling command:", error);
      await interaction.reply({
        content: `Error: ${error.message}`,
        ephemeral: true,
      });

      await prisma.errorLog.create({
        data: {
          command: interaction.commandName,
          error: error.message,
          stack: error.stack,
          userId: discordId,
          timestamp: new Date(),
        },
      });
    }
  }
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Cleaning up...");
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. Cleaning up...");
  await prisma.$disconnect();
  client.destroy();
  process.exit(0);
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
