const nodemailer = require("nodemailer");
const express = require("express");
const cron = require("node-cron");
const app = express();
const port = 3000;
const cheerio = require("cheerio");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const THE_VERGE_URL = "https://theverge.com/";
const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";
const CITY_NAME = "Kelowna";
const smtpUser = process.env.USER;
const smtpPass = process.env.PASS;

// Add outlook functionality

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

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
            tell me the maximum temperature as a whole number with no units, the wind speed in m/s as a whole number, 
            and the current conditions (noted as 'description').
            Also tell me the top two headlines from The Verge from this list: ${headlines} as bullet points with '-' on a new paragraph.
            Finally, tell me a fact about space.`,
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
      user: smtpUser,
      pass: smtpPass,
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
  const headlines = await scrapeHeadlines(THE_VERGE_URL);
  const weather = await getForecast(process.env.OPENWEATHERMAP_API_KEY, CITY_NAME);
  const message = await generateGreeting(headlines, weather);
  console.log(message);

  sendSMS(process.env.PHONE_NUMBER, message);
}

process.env.TZ = "America/Los_Angeles";

cron.schedule("0 7 * * *", () => {
  sendMorningGreeting();
});