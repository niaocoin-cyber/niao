const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.static(__dirname));

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || '';
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET || '';
const TWITTER_API_KEY = process.env.TWITTER_API_KEY || '';
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3001/api/auth/twitter/callback';

let stateStore = {};

function generateCodeVerifier() {
  const crypto = require('crypto');
  const verifier = crypto.randomBytes(32).toString('base64url');
  return verifier;
}

function generateCodeChallenge(verifier) {
  const crypto = require('crypto');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return challenge;
}

app.get('/api/auth/twitter', async (req, res) => {
  try {
    if (!TWITTER_CLIENT_ID) {
      return res.status(500).json({ error: 'Twitter Client ID not configured' });
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = Math.random().toString(36).substring(7) + Date.now().toString();

    stateStore[state] = { codeVerifier, timestamp: Date.now() };

    const authUrl = `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(TWITTER_CLIENT_ID)}&` +
      `redirect_uri=${encodeURIComponent(CALLBACK_URL)}&` +
      `scope=tweet.read+users.read+follows.read&` +
      `state=${state}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`;

    res.json({ redirectUrl: authUrl });

  } catch (error) {
    console.error('Error getting Twitter auth URL:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initiate Twitter authentication' });
  }
});

app.get('/api/auth/twitter/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${FRONTEND_URL}/callback.html?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/callback.html?error=missing_params`);
    }

    const stateData = stateStore[state];
    if (!stateData) {
      return res.redirect(`${FRONTEND_URL}/callback.html?error=invalid_state`);
    }

    delete stateStore[state];

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: CALLBACK_URL,
      code_verifier: stateData.codeVerifier,
      code: code
    });

    const tokenResponse = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      tokenParams,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get(
      'https://api.twitter.com/2/users/me',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const username = userResponse.data.data.username;
    const userId = userResponse.data.data.id;

    res.redirect(`${FRONTEND_URL}/callback.html?success=1&username=${encodeURIComponent(username)}&user_id=${userId}`);

  } catch (error) {
    console.error('Error getting Twitter access token:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}/callback.html?error=auth_failed`);
  }
});

app.post('/api/auth/twitter/unlink', (req, res) => {
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    twitterConfigured: TWITTER_CLIENT_ID !== ''
  });
});

setInterval(() => {
  const now = Date.now();
  Object.keys(stateStore).forEach(key => {
    if (now - stateStore[key].timestamp > 300000) {
      delete stateStore[key];
    }
  });
}, 60000);

app.listen(PORT, () => {
  console.log(`X Auth Server running on port ${PORT}`);
  console.log(`Twitter Client ID configured: ${TWITTER_CLIENT_ID !== '' ? 'Yes' : 'No - Set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env file'}`);
  console.log(`Callback URL: ${CALLBACK_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
});