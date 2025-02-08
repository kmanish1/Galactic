require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const express = require("express");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");

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
    name: "wallets",
    description: "Get your wallets.",
  },
  {
    name: "createwallet",
    description: "Create a new wallet.",
  },
  {
    name: "portfolio",
    description: "Get your portfolio details.",
  },
  {
    name: "refresh_token",
    description: "Refresh your access token.",
  },
  {
    name: "logout",
    description: "Logout from Okto.",
  },
  {
    name: "userdetails",
    description: "Get your user details.",
  },
  {
    name: "networks",
    description: "Get supported networks.",
  },
  {
    name: "tokens",
    description: "Get supported tokens.",
  },
  {
    name: "transfer",
    description: "Transfer tokens.",
    options: [
      {
        name: "network",
        description: "The blockchain network name.",
        type: 3,
        required: true,
      },
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
    name: "orders",
    description: "Get your order history.",
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

async function sendDiscordMessage(discordId, content) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(content);
  } catch (error) {
    console.error(`Failed to send DM to user ${discordId}:`, error);
  }
}

async function callOktoApi(discordId, method, endpoint, params = null) {
  const user = await prisma.user.findUnique({
    where: { discordId },
  });

  if (!user || !user.auth_token) {
    throw new Error("Please login first using /login command");
  }

  const headers = {
    Authorization: `Bearer ${user.auth_token}`,
    "X-Api-Key": process.env.OKTO_CLIENT_API_KEY,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios({
      method,
      url: `https://sandbox-api.okto.tech${endpoint}`,
      headers,
      data: params,
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error("Session expired. Please login again using /login");
    }
    throw new Error(error.response?.data?.message || error.message);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user } = interaction;
  const discordId = user.id;

  try {
    switch (commandName) {
      case "login":
        const redirectUri = `http://localhost:3000/auth/google/callback`;
        const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
          process.env.GOOGLE_CLIENT_ID
        }&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=openid%20email%20profile&state=${discordId}`;

        await prisma.user.upsert({
          where: { discordId },
          update: { status: "awaiting_auth" },
          create: {
            discordId,
            status: "awaiting_auth",
          },
        });

        try {
          const user = await client.users.fetch(discordId);
          await user.send(`Please log in using this link: ${oauthUrl}`);
          await interaction.reply({
            content: "I have sent you a DM with the login link.",
            ephemeral: true,
          });
        } catch (error) {
          await interaction.reply({
            content:
              "I couldn't send you a DM. Please check your privacy settings.",
            ephemeral: true,
          });
        }
        break;

      case "wallets":
        const walletUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!walletUser || !walletUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const wallets = await callOktoApi(discordId, "get", "/api/v1/wallet");
        await interaction.reply({
          content: `Your wallets: ${JSON.stringify(
            wallets.data.wallets,
            null,
            2
          )}`,
          ephemeral: true,
        });
        break;

      case "createwallet":
        const createWalletUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!createWalletUser || !createWalletUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }

        try {
          const result = await callOktoApi(discordId, "post", "/api/v1/wallet");
          await interaction.reply({
            content: `Wallet created successfully: ${JSON.stringify(
              result.data.wallets,
              null,
              2
            )}`,
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

      case "portfolio":
        const portfolioUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!portfolioUser || !portfolioUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const portfolio = await callOktoApi(
          discordId,
          "get",
          "/api/v1/portfolio"
        );
        await interaction.reply({
          content: `Your portfolio: ${JSON.stringify(portfolio.data, null, 2)}`,
          ephemeral: true,
        });
        break;

      case "refresh_token":
        const refreshTokenUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!refreshTokenUser || !refreshTokenUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const refreshResult = await callOktoApi(
          discordId,
          "post",
          "/api/v1/refresh_token"
        );
        await interaction.reply({
          content: "Token refreshed successfully.",
          ephemeral: true,
        });
        break;

      case "logout":
        const logoutUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!logoutUser || !logoutUser.auth_token) {
          return interaction.reply({
            content: "You are not logged in.",
            ephemeral: true,
          });
        }

        await callOktoApi(discordId, "post", "/api/v1/logout");
        await prisma.user.update({
          where: { discordId },
          data: {
            auth_token: null,
            refresh_auth_token: null,
            device_token: null,
            status: "logged_out",
          },
        });

        await interaction.reply({
          content: "Successfully logged out from Okto.",
          ephemeral: true,
        });
        break;

      case "userdetails":
        const userDetailsUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!userDetailsUser || !userDetailsUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const userDetails = await callOktoApi(
          discordId,
          "get",
          "/api/v1/user_from_token"
        );
        await interaction.reply({
          content: `User details: ${JSON.stringify(userDetails.data, null, 2)}`,
          ephemeral: true,
        });
        break;

      case "networks":
        const networksUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!networksUser || !networksUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const networks = await callOktoApi(
          discordId,
          "get",
          "/api/v1/supported/networks"
        );
        await interaction.reply({
          content: `Supported networks: ${JSON.stringify(
            networks.data.network,
            null,
            2
          )}`,
          ephemeral: true,
        });
        break;

      case "tokens":
        const tokensUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!tokensUser || !tokensUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const tokens = await callOktoApi(
          discordId,
          "get",
          "/api/v1/supported/tokens"
        );
        await interaction.reply({
          content: `Supported tokens: ${JSON.stringify(
            tokens.data.tokens,
            null,
            2
          )}`,
          ephemeral: true,
        });
        break;

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
        const transferResult = await callOktoApi(
          discordId,
          "post",
          "/api/v1/transfer/tokens/execute",
          {
            network_name: options.getString("network"),
            token_address: options.getString("token_address"),
            quantity: options.getNumber("quantity"),
            recipient_address: options.getString("recipient"),
          }
        );
        await interaction.reply({
          content: `Token transfer initiated. Order ID: ${transferResult.data.orderId}`,
          ephemeral: true,
        });
        break;

      case "orders":
        const ordersUser = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!ordersUser || !ordersUser.auth_token) {
          return interaction.reply({
            content: "Please log in first using `/login`.",
            ephemeral: true,
          });
        }
        const orders = await callOktoApi(discordId, "get", "/api/v1/orders");
        await interaction.reply({
          content: `Your orders: ${JSON.stringify(orders.data.jobs, null, 2)}`,
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

app.get("/auth/google/callback", async (req, res) => {
  const { code, state: discordId } = req.query;

  if (!code || !discordId) {
    return res.status(400).send("Invalid request");
  }

  try {
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      null,
      {
        params: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: `http://localhost:3000/auth/google/callback`,
        },
      }
    );

    const idToken = tokenResponse.data.id_token;
    if (!idToken) {
      return res.status(400).send("Failed to retrieve id_token from Google");
    }

    try {
      const oktoResponse = await axios.post(
        "https://sandbox-api.okto.tech/api/v2/authenticate",
        { id_token: idToken },
        {
          headers: {
            "X-Api-Key": process.env.OKTO_CLIENT_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      const authData = oktoResponse.data.data;
      await prisma.user.update({
        where: { discordId },
        data: {
          auth_token: authData.auth_token,
          refresh_auth_token: authData.refresh_auth_token,
          device_token: authData.device_token,
          status: "authenticated",
        },
      });

      await sendDiscordMessage(
        discordId,
        "You have been successfully authenticated with Okto!"
      );

      res.send(
        "You have been successfully authenticated! You can now return to Discord."
      );
    } catch (oktoError) {
      console.error("Okto API Error:", oktoError);
      res.status(500).send("Okto authentication failed.");
    }
  } catch (error) {
    console.error("Error during Google token exchange:", error);
    res.status(500).send("Google token exchange failed.");
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
