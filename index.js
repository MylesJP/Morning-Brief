const nodemailer = require("nodemailer");
const cron = require('node-cron')
const moment = require('moment-timezone')
const cheerio = require("cheerio");
const axios = require("axios");
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

async function scrapeHeadlines() {
  var headlines = [];
  try {
    const url = "https://theverge.com/";
    const response = await axios.get(url);

    // Load the HTML content into cheerio
    const $ = cheerio.load(response.data);

    // Extract the headlines using CSS selectors
    $("h2").each((index, element) => {
      const headline = $(element).find("a").text().trim();
      headlines.push(headline);
    });

    // Display the headlines
    blankRemoved = headlines.splice(1, 1); // Remove a blank element
    console.log(headlines);
  } catch (error) {
    console.error("Error:", error);
  }
  return headlines;
}

async function getForecast() {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const city = "Kelowna";
  var weather; // Declare the weather variable

  try {
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
    );
    //console.log(response.data);
    weather = JSON.stringify(response.data);
  } catch (error) {
    console.log("Error occurred while fetching weather data:", error.message);
  }
  return weather;
}

async function generateGreeting() {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const headlines = await scrapeHeadlines();
  const weather = await getForecast();
  const openai = new OpenAIApi(configuration);

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: `Say good morning to Myles along with an uplifting message. Tell me the forecast for the day from this file: ${weather}. Specifically,
            tell me the high today as a whole number with no units, the wind speed in km/h as a whole number, 
            and the current conditions (noted as 'description'). 
            Also tell me the top two headlines from The Verge from this list: ${headlines} as bullet points with '-' on a new paragraph.`,
    max_tokens: 100,
    temperature: 0.4,
  });
  const ai_output = response.data.choices[0].text.trim();
  console.log(ai_output);
  return ai_output;
}

async function sendSMS(phoneNumber) {
  const message = await generateGreeting();
  const email = phoneNumber + "@txt.bell.ca";

  const smtpConfig = {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: "mj.penner@live.ca",
      pass: "zighyrfrluqiqria",
    },
  };

  const transporter = nodemailer.createTransport(smtpConfig);

  const mailOptions = {
    from: "mj.penner@live.ca",
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

process.env.TZ = 'America/Los_Angeles'

cron.schedule('0 7 * * *', () => {
  sendSMS(process.env.PHONE_NUMBER);
})
//generateGreeting();
//getForecast();
//scrapeHeadlines()
