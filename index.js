const nodemailer = require("nodemailer");
const express = require("express");
const cron = require("node-cron");
const port = 3000;
const cheerio = require("cheerio");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
require("dotenv").config();

const THE_VERGE_URL = "https://theverge.com/";
const WEATHER_API_URL = "http://api.openweathermap.org/data/2.5/weather";
const CITY_NAME = "Kelowna";
const SMTP_USER = process.env.USER;
const SMTP_PASS = process.env.PASS;

// Add outlook functionality

const app = express();
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

/**
 * Scrapes top two headlines of given url and returns an array of those headlines.
 * Note this function currently only works for The Verge as every news website
 * uses different HTML tags for their headlines.
 *
 * @param {string} url - URL string of site to scrape headlines.
 * @returns {Promise<string[]>} - Promise that resolves to array of headlines.
 * @throws {Error} - If an error occurs during the request.
 *
 */
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

/**
 * Uses OpenWeatherMap API to fetch days weather data for a city.
 *
 * @param {string} apiKey - API key for OpenWeatherMap.
 * @param {string} city - City you want forecast for.
 * @returns {Promise<string>} - Promise that resolves to JSON string of daily weather data.
 * @throws {Error} - If an error occurs during the request.
 *
 */
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

/**
 * Uses OpenAI API to generate a text message greeting incorporating the daily
 * headlines and the weather for the day.
 *
 * @param {string[]} headlines - Headlines string from scrapeHeadlines().
 * @param {string} weather - Weather JSON string from getForecast().
 * @returns {Promise<string>} - Promise that resolves to complete message from GPT-3.5.
 * @throws {Error} - If an error occurs during the request.
 *
 */
async function generateGreeting(headlines, weather) {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const openai = new OpenAIApi(configuration);

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Say good morning to Myles. Tell me the forecast for the day from this file: ${weather}. Specifically,
            tell me the maximum temperature as a whole number with no units, the wind speed in m/s as a whole number, 
            and the current conditions (noted as 'description').
            Also tell me the top two headlines from The Verge in bullet form from this list: ${headlines} on a new paragraph.
            Finally, tell me a fact about space on a new paragraph.`,
    max_tokens: 250,
    temperature: 0.2,
  });
  const ai_output = response.data.choices[0].text.trim();
  return ai_output;
}

/**
 * Uses nodemailer to send a text via emai containing the AI message. Note this function
 * as written is for sending a text from an Outlook email to a Bell Canada phone.
 *
 * @param {string} phoneNumber - Phone number to send text to.
 * @param {string} message - AI message to text.
 * @throws {Error} - If an error occurs during the request.
 *
 */
async function sendSMS(phoneNumber, message) {
  const smtpConfig = {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
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

/**
 * Send a morning greeting containing headlines and weather information via SMS.
 * It fetches the headlines from The Verge, retrieves the weather forecast, generates a greeting message,
 * and sends the message to the specified phone number.
 *
 * @throws {Error} - If there is an error during any of the steps of fetching headlines, retrieving weather,
 *                   generating the greeting message, or sending the SMS.
 */
async function sendMorningGreeting() {
  const headlines = await scrapeHeadlines(THE_VERGE_URL);
  const weather = await getForecast(process.env.OPENWEATHERMAP_API_KEY, CITY_NAME);
  const message = await generateGreeting(headlines, weather);
  sendSMS(process.env.PHONE_NUMBER, message);
}

process.env.TZ = "America/Los_Angeles";

cron.schedule("0 8 * * *", () => {
  sendMorningGreeting();
});
