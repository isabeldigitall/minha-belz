require("dotenv").config();
const path = require("path");

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[ERRO] Variavel ${name} nao definida no .env`);
    process.exit(1);
  }
  return value;
}

module.exports = {
  // Como a aluna quer ser tratada
  OWNER_NAME: process.env.OWNER_NAME || "Amiga",
  // Nome da propria assistente (pode manter "Belz" ou dar um nome proprio)
  ASSISTANT_NAME: process.env.ASSISTANT_NAME || "Belz",
  TELEGRAM_BOT_TOKEN: required("TELEGRAM_BOT_TOKEN"),
  GEMINI_API_KEY: required("GEMINI_API_KEY"),
  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
  GOOGLE_EMAIL: required("GOOGLE_EMAIL"),
  TIMEZONE: process.env.TIMEZONE || "Europe/Lisbon",
  BRIEFING_HOUR: parseInt(process.env.BRIEFING_HOUR || "8", 10),
  PORT: parseInt(process.env.PORT || "3000", 10),

  OAUTH_TOKEN_PATH: path.join(__dirname, "oauth-token.json"),
  REMINDERS_FILE: path.join(__dirname, "reminders.json"),
  OWNER_FILE: path.join(__dirname, ".owner_chat_id"),
  DOC_CONFIG_FILE: path.join(__dirname, "doc-config.json"),
};
