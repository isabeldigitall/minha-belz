const { google } = require("googleapis");
const fs = require("fs");
const config = require("./config");
const { log } = require("./utils");

let calendarClient = null;
let oauthClient = null;

function getAuth() {
  if (oauthClient) return oauthClient;

  if (!fs.existsSync(config.OAUTH_TOKEN_PATH)) {
    throw new Error(`Token OAuth nao encontrado. Corre: npm run setup`);
  }

  const tokenData = JSON.parse(
    fs.readFileSync(config.OAUTH_TOKEN_PATH, "utf8"),
  );

  oauthClient = new google.auth.OAuth2(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
  );

  oauthClient.setCredentials({
    refresh_token: tokenData.refresh_token,
    access_token: tokenData.access_token,
  });

  oauthClient.on("tokens", (tokens) => {
    try {
      const existing = JSON.parse(
        fs.readFileSync(config.OAUTH_TOKEN_PATH, "utf8"),
      );
      if (tokens.refresh_token) existing.refresh_token = tokens.refresh_token;
      if (tokens.access_token) existing.access_token = tokens.access_token;
      fs.writeFileSync(
        config.OAUTH_TOKEN_PATH,
        JSON.stringify(existing, null, 2),
      );
      log("Token Google atualizado");
    } catch {}
  });

  return oauthClient;
}

function getCalendar() {
  if (!calendarClient) {
    calendarClient = google.calendar({ version: "v3", auth: getAuth() });
  }
  return calendarClient;
}

async function getEvents(dateStr) {
  const cal = getCalendar();
  const date = new Date(dateStr);
  const timeMin = new Date(date);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(date);
  timeMax.setHours(23, 59, 59, 999);

  const res = await cal.events.list({
    calendarId: config.GOOGLE_EMAIL,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || "(sem titulo)",
    start: ev.start.dateTime || ev.start.date,
    end: ev.end.dateTime || ev.end.date,
  }));
}

async function getUpcomingEvents(days = 7) {
  const cal = getCalendar();
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  const res = await cal.events.list({
    calendarId: config.GOOGLE_EMAIL,
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 30,
  });

  return (res.data.items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || "(sem titulo)",
    start: ev.start.dateTime || ev.start.date,
    end: ev.end.dateTime || ev.end.date,
  }));
}

async function createEvent({
  summary,
  startDateTime,
  endDateTime,
  description,
  location,
}) {
  const cal = getCalendar();
  const event = {
    summary,
    start: { dateTime: startDateTime, timeZone: config.TIMEZONE },
    end: { dateTime: endDateTime, timeZone: config.TIMEZONE },
  };
  if (description) event.description = description;
  if (location) event.location = location;

  const res = await cal.events.insert({
    calendarId: config.GOOGLE_EMAIL,
    resource: event,
  });

  log(`Evento criado: ${summary} em ${startDateTime}`);
  return res.data;
}

function formatEventList(events) {
  if (!events.length) return "Nao tens nada agendado.";
  return events
    .map((ev) => {
      const start = new Date(ev.start);
      const time = start.toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: config.TIMEZONE,
      });
      const isAllDay = !ev.start.includes("T");
      const timeStr = isAllDay ? "Dia inteiro" : time;
      return `- ${timeStr} - ${ev.summary}`;
    })
    .join("\n");
}

function formatDate(date) {
  return date.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: config.TIMEZONE,
  });
}

module.exports = {
  getEvents,
  getUpcomingEvents,
  createEvent,
  formatEventList,
  formatDate,
  getAuth,
};
