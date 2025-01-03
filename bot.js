require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const app = express();

// Discord bot setup with MessageContent intent
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// In-memory store to map Discord IDs to authentication tokens
const userStore = {};

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Discord bot login
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Helper function for sending a DM to the Discord user
async function sendDiscordMessage(discordId, content) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(content);
  } catch (error) {
    console.error(`Failed to send DM to user ${discordId}:`, error);
  }
}

// Helper function for Okto API calls
async function callOktoApi(userId, method, endpoint, params = null) {
  const user = userStore[userId];
  if (!user || !user.auth_token) {
    throw new Error('User is not authenticated.');
  }

  const headers = {
    'Authorization': `Bearer ${user.auth_token}`,
    'X-Api-Key': process.env.OKTO_CLIENT_API_KEY,
    'Content-Type': 'application/json',
  };

  const url = `https://sandbox-api.okto.tech${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      headers,
      data: params,
    });
    return response.data;
  } catch (error) {
    console.error('API Request Error:', error.response ? error.response.data : error.message);
    throw new Error(error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
  }
}

// Discord bot listens for various Okto commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const discordId = message.author.id;

  if (message.content.trim() === '/login') {
    const redirectUri = `http://localhost:3000/auth/google/callback`;
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile&state=${discordId}`;

    userStore[discordId] = { status: 'awaiting_auth' };
    try {
      await message.author.send(`Please log in using this link: ${oauthUrl}`);
      await message.reply('I have sent you a DM with the login link.');
    } catch (error) {
      await message.reply('I couldn\'t send you a DM. Please check your privacy settings.');
    }
  } else if (message.content.trim() === '/wallets') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/wallet');
      await message.reply(`Your wallets: ${JSON.stringify(result.data.wallets, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching wallets: ${error.message}`);
    }
  } else if (message.content.trim() === '/portfolio') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/portfolio');
      await message.reply(`Your portfolio: ${JSON.stringify(result.data, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching portfolio: ${error.message}`);
    }
  } else if (message.content.trim() === '/createwallet') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'post', '/api/v1/wallet');
      await message.reply(`Wallet created successfully: ${JSON.stringify(result.data.wallets, null, 2)}`);
    } catch (error) {
      await message.reply(`Error creating wallet: ${error.message}`);
    }
  } else if (message.content.trim() === '/refresh_token') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'post', '/api/v1/refresh_token');
      await message.reply('Token refreshed successfully.');
    } catch (error) {
      await message.reply(`Error refreshing token: ${error.message}`);
    }
  } else if (message.content.trim() === '/logout') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('You are not logged in.');
    }
    try {
      const result = await callOktoApi(discordId, 'post', '/api/v1/logout');
      delete userStore[discordId];
      await message.reply('Successfully logged out from Okto.');
    } catch (error) {
      await message.reply(`Error during logout: ${error.message}`);
    }
  } else if (message.content.trim() === '/userdetails') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/user_from_token');
      await message.reply(`User details: ${JSON.stringify(result.data, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching user details: ${error.message}`);
    }
  } else if (message.content.trim() === '/networks') {
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/supported/networks');
      await message.reply(`Supported networks: ${JSON.stringify(result.data.network, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching networks: ${error.message}`);
    }
  } else if (message.content.trim() === '/tokens') {
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/supported/tokens');
      await message.reply(`Supported tokens: ${JSON.stringify(result.data.tokens, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching tokens: ${error.message}`);
    }
  } else if (message.content.trim().startsWith('/transfer')) {
    const [_, network_name, token_address, quantity, recipient_address] = message.content.split(' ');
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'post', '/api/v1/transfer/tokens/execute', {
        network_name,
        token_address,
        quantity,
        recipient_address,
      });
      await message.reply(`Token transfer initiated. Order ID: ${result.data.orderId}`);
    } catch (error) {
      await message.reply(`Error during token transfer: ${error.message}`);
    }
  } else if (message.content.trim() === '/orders') {
    if (!userStore[discordId] || !userStore[discordId].auth_token) {
      return message.reply('Please log in first using `/login`.');
    }
    try {
      const result = await callOktoApi(discordId, 'get', '/api/v1/orders');
      await message.reply(`Your orders: ${JSON.stringify(result.data.jobs, null, 2)}`);
    } catch (error) {
      await message.reply(`Error fetching orders: ${error.message}`);
    }
  } else if (message.content.trim() === '/help') {
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
    await message.reply(helpMessage);
  }
});

// OAuth Callback Handler for Google authentication and Okto integration
app.get('/auth/google/callback', async (req, res) => {
  const { code, state: discordId } = req.query;

  if (!code || !discordId) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Exchange authorization code for tokens from Google
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
    console.log('Google ID Token:', idToken);

    if (!idToken) {
      return res.status(400).send('Failed to retrieve id_token from Google');
    }

    // Authenticate with Okto SDK using the id_token
    try {
      const oktoResponse = await axios.post(
        'https://sandbox-api.okto.tech/api/v2/authenticate',
        { id_token: idToken },
        {
          headers: {
            'X-Api-Key': process.env.OKTO_CLIENT_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const authData = oktoResponse.data.data;
      userStore[discordId] = {
        auth_token: authData.auth_token,
        refresh_auth_token: authData.refresh_auth_token,
        device_token: authData.device_token,
        status: 'authenticated',
      };

      // Send a message to the user on successful authentication
      await sendDiscordMessage(discordId, 'You have been successfully authenticated with Okto!');

      res.send('You have been successfully authenticated! You can now return to Discord.');
    } catch (oktoError) {
      console.error('Okto API Error:', JSON.stringify(oktoError.response ? oktoError.response.data : oktoError.message, null, 2));
      res.status(500).send('Okto authentication failed.');
    }
  } catch (error) {
    console.error('Error during Google token exchange:', error.response ? error.response.data : error.message);
    res.status(500).send('Google token exchange failed.');
  }
});

// Log into Discord with your bot token
client.login(process.env.DISCORD_BOT_TOKEN);
