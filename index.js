const express = require("express");
const nodemailer = require("nodemailer");
const cheerio = require("cheerio");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
const { AuthorizationCode } = require("simple-oauth2");
require("dotenv").config();
const qs = require("qs");
const { getOuterHTML } = require("domutils");
const moment = require("moment-timezone");

const THE_VERGE_URL = "https://theverge.com/";
const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";
const CITY_NAME = "Kelowna";
const authority = "https://login.microsoftonline.com";
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const tenantId = process.env.TENANT_ID;
const authorizationEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
const tokenEndpoint =
  "https://login.microsoftonline.com/15519d3e-0a6e-42a1-a443-10589dd0a1de/oauth2/v2.0/token";
const redirectURI = "http://localhost:3000/callback";
const userId = "mj.penner@live.ca";
const scope = "https://graph.microsoft.com/.default";

async function fetchAccessToken() {
  const requestBody = {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: scope,
  };

  try {
    const response = await axios.post(tokenEndpoint, qs.stringify(requestBody), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const accessToken = response.data.access_token;
    console.log("Access token:", accessToken);

    return accessToken;
  } catch (error) {
    console.error("Error fetching access token:", error);
  }
}

async function getOutlookEvents(userId, accessToken) {
  const date = new Date();
  date.setHours(7, 0, 0, 0);
  const startDate = date.toISOString();

  date.setDate(date.getDate());
  date.setHours(23, 59, 0, 0);
  const endDate = date.toISOString();

  const url = `https://graph.microsoft.com/v1.0/users/${userId}/calendarView?startDateTime=${startDate}&endDateTime=${endDate}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="Pacific Standard Time"',
      },
    });

    let eventString = "";
    // console.log(response.data.value)
    response.data.value.forEach((object) => {
      const eventName = object.subject;
      const startTime = object.start.dateTime;

      const eventInfo = `${eventName} at ${startTime}`;
      eventString += eventInfo + ", ";
    });
    console.log(eventString);
    return eventString;
  } catch (error) {
    console.error("Error getting calendar events:", error);
  }
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
    prompt: `Say good morning to Myles. Tell me the forecast for the day from this file: ${weather}. Specifically,
            tell me the maximum temperature as a whole number, the wind speed in m/s as a whole number, 
            and the current conditions (noted as 'description').
            Also tell me the top two headlines from The Verge from this list: ${headlines} as bullet points with '-' on a new paragraph.
            Finally, summarize my schedule from this: ${events} on a new paragraph with bullets.
            If an event is at 12 AM, don't specify the time.`,
    max_tokens: 250,
    temperature: 0.4,
  });
  const ai_output = response.data.choices[0].text.trim();
  return ai_output;
}

async function sendSMS(phoneNumber, message) {
  const smtpConfig = {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "mj.penner@live.ca",
      pass: "zighyrfrluqiqria",
    },
  };

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

async function sendMorningGreeting() {
  const token = await fetchAccessToken();
  const events = await getOutlookEvents(userId, token);
  console.log(events);
  //const headlines = await scrapeHeadlines(THE_VERGE_URL);
  //const weather = await getForecast(process.env.OPENWEATHERMAP_API_KEY, CITY_NAME);
  //const message = await generateGreeting(headlines, weather, events);
  //console.log(message)

  //sendSMS(process.env.PHONE_NUMBER, message);
}

process.env.TZ = "America/Los_Angeles";

// cron.schedule("0 7 * * *", () => {
//   sendMorningGreeting();
// });

sendMorningGreeting();
//getOutlookEvents(userId)
