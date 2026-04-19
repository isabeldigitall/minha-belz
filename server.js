const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const fs = require("fs");
const https = require("https");
const http = require("http");
const config = require("./config");
const { log } = require("./utils");
const { understand, transcribeAudio, addToHistory } = require("./ai");
const {
  getEvents,
  getUpcomingEvents,
  createEvent,
  formatEventList,
  formatDate,
} = require("./calendar");
const {
  addReminder,
  listReminders,
  loadReminders,
  saveReminders,
  formatReminderList,
} = require("./reminders");

const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: {
    interval: 1000,
    autoStart: true,
    params: { timeout: 30, allowed_updates: ["message", "callback_query"] },
  },
});

bot.on("polling_error", (err) => log(`Polling error: ${err.message}`));

function getOwnerChatId() {
  try {
    return fs.readFileSync(config.OWNER_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

function setOwnerChatId(chatId) {
  fs.writeFileSync(config.OWNER_FILE, String(chatId));
  log(`Owner definido: ${chatId}`);
}

function isOwner(chatId) {
  const owner = getOwnerChatId();
  if (!owner) return false;
  return String(chatId) === owner;
}

async function reply(chatId, text) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch {
    try {
      await bot.sendMessage(chatId, text);
    } catch (e) {
      log(`Erro ao enviar: ${e.message}`);
    }
  }
  addToHistory("belz", text);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  log(
    `[TELEGRAM] msg de ${msg.from.first_name} (${chatId}): ${msg.text || "[media]"}`,
  );

  const owner = getOwnerChatId();
  if (!owner) {
    setOwnerChatId(chatId);
    log(`Owner auto-registado: ${chatId}`);
  }

  if (!isOwner(chatId)) {
    await reply(chatId, "Desculpa, sou uma assistente pessoal privada.");
    return;
  }

  if (msg.text && msg.text.startsWith("/start")) {
    await reply(
      chatId,
      `Ola ${config.OWNER_NAME}! Sou a tua assistente pessoal.\n\n` +
        `O que posso fazer:\n` +
        `Consultar e criar eventos na agenda\n` +
        `Criar e gerir lembretes\n\n` +
        `Todas as manhas as ${config.BRIEFING_HOUR}h envio o resumo do dia.\n\n` +
        `Experimenta: "O que tenho amanha?"`,
    );
    return;
  }

  if (msg.voice || msg.audio) {
    await handleVoice(msg, chatId);
    return;
  }

  const text = msg.text || "";
  if (!text.trim()) return;

  const result = await understand(text);
  await dispatch(result, chatId);
});

async function dispatch(result, chatId) {
  switch (result.intent) {
    case "check_agenda":
      return handleCheckAgenda(result.params, chatId);
    case "check_week":
      return handleCheckWeek(result.params, chatId);
    case "create_event":
      return handleCreateEvent(result.params, result.reply, chatId);
    case "create_reminder":
      return handleCreateReminder(result.params, result.reply, chatId);
    case "list_reminders":
      return handleListReminders(chatId);
    default:
      return reply(chatId, result.reply || "Estou aqui!");
  }
}

async function handleCheckAgenda(params, chatId) {
  try {
    const date = params.date || new Date().toISOString().slice(0, 10);
    const events = await getEvents(date);
    const dateObj = new Date(date + "T00:00:00");
    const header = `*Agenda de ${formatDate(dateObj)}:*\n\n`;
    await reply(chatId, header + formatEventList(events));
  } catch (err) {
    log(`Erro check_agenda: ${err.message}`);
    await reply(chatId, "Nao consegui aceder a agenda. Tenta novamente.");
  }
}

async function handleCheckWeek(params, chatId) {
  try {
    const days = params.days || 7;
    const events = await getUpcomingEvents(days);
    await reply(
      chatId,
      `*Proximos ${days} dias:*\n\n` + formatEventList(events),
    );
  } catch (err) {
    log(`Erro check_week: ${err.message}`);
    await reply(chatId, "Nao consegui aceder a agenda.");
  }
}

async function handleCreateEvent(params, aiReply, chatId) {
  try {
    if (!params.date || !params.startTime || !params.summary) {
      await reply(
        chatId,
        aiReply || "Preciso de mais detalhes. Qual o nome, data e hora?",
      );
      return;
    }
    const startDateTime = `${params.date}T${params.startTime}:00`;
    const endTime = params.endTime || addHour(params.startTime);
    const endDateTime = `${params.date}T${endTime}:00`;
    await createEvent({
      summary: params.summary,
      startDateTime,
      endDateTime,
      description: params.description,
    });
    const dateObj = new Date(startDateTime);
    await reply(
      chatId,
      `Marquei *${params.summary}* para ${formatDate(dateObj)} as ${params.startTime}`,
    );
  } catch (err) {
    log(`Erro create_event: ${err.message}`);
    await reply(chatId, "Nao consegui criar o evento.");
  }
}

async function handleCreateReminder(params, aiReply, chatId) {
  try {
    if (!params.text || !params.dateTime) {
      await reply(
        chatId,
        aiReply || "Para quando queres o lembrete e sobre o que?",
      );
      return;
    }
    addReminder({ text: params.text, dateTime: params.dateTime });
    const dt = new Date(params.dateTime);
    const time = dt.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: config.TIMEZONE,
    });
    const date = dt.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      timeZone: config.TIMEZONE,
    });
    await reply(chatId, `Lembrete: "${params.text}" para ${date} as ${time}`);
  } catch (err) {
    log(`Erro create_reminder: ${err.message}`);
    await reply(chatId, "Nao consegui criar o lembrete.");
  }
}

async function handleListReminders(chatId) {
  const reminders = listReminders();
  await reply(
    chatId,
    "*Lembretes pendentes:*\n\n" + formatReminderList(reminders),
  );
}

async function handleVoice(msg, chatId) {
  try {
    const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
    const fileUrl = await bot.getFileLink(fileId);
    const buffer = await downloadBuffer(fileUrl);
    const transcription = await transcribeAudio(buffer);
    if (!transcription) {
      await reply(
        chatId,
        "Nao consegui perceber o audio. Podes repetir ou escrever?",
      );
      return;
    }
    log(`Transcricao: "${transcription}"`);
    const result = await understand(transcription);
    await dispatch(result, chatId);
  } catch (err) {
    log(`Erro voice: ${err.message}`);
    await reply(chatId, "Erro ao processar o audio.");
  }
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith("https") ? https : http;
    getter
      .get(url, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function addHour(time) {
  const [h, m] = time.split(":").map(Number);
  const newH = (h + 1) % 24;
  return `${newH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

cron.schedule("* * * * *", async () => {
  try {
    const owner = getOwnerChatId();
    if (!owner) return;
    const reminders = loadReminders();
    const now = new Date();
    let updated = false;
    for (const r of reminders) {
      if (r.sent) continue;
      if (now >= new Date(r.dateTime)) {
        await reply(owner, `*Lembrete:* ${r.text}`);
        r.sent = true;
        updated = true;
      }
    }
    if (updated) {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const cleaned = reminders.filter(
        (r) => !r.sent || new Date(r.dateTime) > weekAgo,
      );
      saveReminders(cleaned);
    }
  } catch (err) {
    if (!err.message.includes("ENOENT"))
      log(`Erro cron reminders: ${err.message}`);
  }
});

cron.schedule(
  `0 ${config.BRIEFING_HOUR} * * *`,
  async () => {
    try {
      const owner = getOwnerChatId();
      if (!owner) return;
      const today = new Date().toISOString().slice(0, 10);
      const events = await getEvents(today);
      let msg = `Bom dia ${config.OWNER_NAME}!\n\n*Hoje (${formatDate(new Date())}):*\n`;
      msg += formatEventList(events);
      const reminders = listReminders();
      if (reminders.length > 0) {
        msg += `\n\n*Lembretes pendentes:*\n` + formatReminderList(reminders);
      }
      await reply(owner, msg);
      log("Briefing matinal enviado");
    } catch (err) {
      log(`Erro briefing: ${err.message}`);
    }
  },
  { timezone: config.TIMEZONE },
);

log("A tua Belz a iniciar...");
log(
  `Owner: ${config.OWNER_NAME} | TZ: ${config.TIMEZONE} | Briefing: ${config.BRIEFING_HOUR}h`,
);
log("Envia /start ao bot no Telegram para comecar.");
