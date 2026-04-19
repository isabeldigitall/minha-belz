const fs = require("fs");
const config = require("./config");
const { log } = require("./utils");

function loadReminders() {
  try {
    return JSON.parse(fs.readFileSync(config.REMINDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveReminders(reminders) {
  fs.writeFileSync(config.REMINDERS_FILE, JSON.stringify(reminders, null, 2));
}

function addReminder({ text, dateTime }) {
  const reminders = loadReminders();
  const id = Date.now().toString(36);
  reminders.push({ id, text, dateTime, sent: false });
  saveReminders(reminders);
  log(`Lembrete criado: "${text}" para ${dateTime}`);
  return id;
}

function listReminders() {
  return loadReminders().filter((r) => !r.sent);
}

function formatReminderList(reminders) {
  if (!reminders.length) return "Nao tens lembretes pendentes.";
  return reminders
    .map((r) => {
      const dt = new Date(r.dateTime);
      const date = dt.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        timeZone: config.TIMEZONE,
      });
      const time = dt.toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: config.TIMEZONE,
      });
      return `- ${date} ${time} - ${r.text}`;
    })
    .join("\n");
}

module.exports = {
  addReminder,
  listReminders,
  loadReminders,
  saveReminders,
  formatReminderList,
};
