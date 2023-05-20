const express = require('express');
const axios = require('axios');
const { AuthorizationCode } = require('simple-oauth2');
require('dotenv').config();

const app = express();
const port = 3000;

const client = new AuthorizationCode({
  client: {
    id: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: process.env.TENANT_ID + '/oauth2/v2.0/authorize',
    tokenPath: process.env.TENANT_ID + '/oauth2/v2.0/token',
  },
});

// Redirect user to Microsoft login page
app.get('/login', (req, res) => {
  const authorizationUri = client.authorizeURL({
    redirect_uri: 'http://localhost:3000/callback',
    scope: 'https://graph.microsoft.com/Calendars.Read',
    state: '3(#0/!~',
  });
  res.redirect(authorizationUri);
});

// Handle callback from Microsoft login page
app.get('/callback', async (req, res) => {
  const { code } = req.query;
  const options = {
    code,
    redirect_uri: 'http://localhost:3000/callback',
    scope: 'https://graph.microsoft.com/Calendars.Read',
  };

  const accessToken = await client.getToken(options);
  try {

    // Now that we have the access token, we can make API requests
    // Save the access token if you want to make further requests
    console.log(accessToken.token.access_token);
  } catch (error) {
    console.error('Access Token Error', error.message);
  }

  // For now, just display the access token in the browser
  res.send(`Access Token: ${accessToken.token.access_token}`);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
