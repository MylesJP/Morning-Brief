const express = require("express");
const nodemailer = require("nodemailer");
const cheerio = require("cheerio");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
const { AuthorizationCode } = require("simple-oauth2");
require("dotenv").config();

const app = express();
const PORT = 3000;

const THE_VERGE_URL = "https://theverge.com/";
const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";
const CITY_NAME = "Kelowna";

// Set up the OAuth2 client
const client = new AuthorizationCode({
  client: {
    id: process.env.CLIENT_ID,
    secret: process.env.CLIENT_SECRET,
  },
  auth: {
    tokenHost: "https://login.microsoftonline.com",
    authorizePath: process.env.TENANT_ID + "/oauth2/v2.0/authorize",
    tokenPath: process.env.TENANT_ID + "/oauth2/v2.0/token",
  },
});

let accessToken;

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  const options = {
    code,
    redirect_uri: "http://localhost:3000/callback",
    scope: "https://graph.microsoft.com/Calendars.Read",
  };

  try {
    accessToken = await client.getToken(options);
    console.log(accessToken.token.access_token);
    // await getOutlookEvents();
    await main();
  } catch (error) {
    console.error("Access Token Error", error.message);
  }
  res.send(`Access Token: ${accessToken.token.access_token}`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function getOutlookEvents() {
  const today = new Date();
  const isoDate = today.toISOString();
  let events = [];

  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/me/calendarview?startdatetime=${isoDate}&enddatetime=${isoDate}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.token.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Print the events
    console.log(response.data.value);
    events = response.data.value;
  } catch (error) {
    console.error(error);
  }
  return events;
}

async function scrapeHeadlines(url) {
  let headlines = [];
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    $("h2").each((index, element) => {
      const headline = $(element).find("a").text().trim();
      if (headline) headlines.push(headline);
    });
  } catch (error) {
    console.error("Error:", error);
  }

  // Filter out blank headlines
  headlines = headlines.filter((headline) => headline !== "");
  return headlines;
}

async function getForecast(apiKey, city) {
  let weather = null;
  try {
    const response = await axios.get(
      `${WEATHER_API_URL}?q=${city}&appid=${apiKey}&units=metric`
    );
    weather = JSON.stringify(response.data);
  } catch (error) {
    console.log("Error occurred while fetching weather data:", error.message);
  }
  return weather;
}

async function generateGreeting(headlines, weather, events) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Say good morning to Myles along with an encouraging message. Tell me the forecast for the day from this file: ${weather}. Specifically,
            tell me the high today as a whole number with no units, the wind speed in km/h as a whole number, 
            and the current conditions (noted as 'description').
            Also tell me the top two headlines from The Verge from this list: ${headlines} as bullet points with '-' on a new paragraph.
            Finally, summarize my daily schedule from this: ${JSON.stringify(events)}`,
    max_tokens: 100,
    temperature: 0.4,
  });
  const ai_output = response.data.choices[0].text.trim();
  return ai_output;
}

async function sendSMS(phoneNumber, message, smtpConfig) {
  const email = phoneNumber + "@txt.bell.ca";
  const transporter = nodemailer.createTransport(smtpConfig);
  const mailOptions = {
    from: smtpConfig.auth.user,
    to: email,
    subject: "",
    text: message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("SMS Successful!");
  } catch (error) {
    console.log(error);
  }
}

async function main() {
  const headlines = await scrapeHeadlines(THE_VERGE_URL);
  const weather = await getForecast(process.env.OPENWEATHERMAP_API_KEY, CITY_NAME);
  const events = await getOutlookEvents();
  const message = await generateGreeting(headlines, weather, events);

  const smtpConfig = {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "mj.penner@live.ca",
      pass: "zighyrfrluqiqria",
    },
  };
  sendSMS(process.env.PHONE_NUMBER, message, smtpConfig);
}

process.env.TZ = "America/Los_Angeles";

//generateGreeting();
//getForecast();
//scrapeHeadlines()
main();
//getOutlookEvents();
