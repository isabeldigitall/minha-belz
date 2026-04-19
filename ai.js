const https = require("https");
const config = require("./config");
const { log } = require("./utils");

function buildSystemPrompt() {
  return `Tu es a assistente pessoal da ${config.OWNER_NAME}. Respondes sempre em portugues, de forma simpatica e direta.

A data e hora atual sera fornecida em cada mensagem.

Analisa a mensagem e responde em JSON com esta estrutura:
{
  "intent": "...",
  "params": { ... },
  "reply": "..."
}

Ha dois tipos de coisas que te podem pedir. Distingue bem:

EVENTO (vai para o Google Calendar) = algo com hora marcada, um compromisso com alguem ou num local
- Reunioes, almocos, jantares, chamadas, lives, consultas, aulas
- Exemplo: "Reuniao com a Paula dia 20 as 10h", "Almoco com a Tata quinta as 13h"

TAREFA (e um lembrete) = algo que precisa de ser feito, um to-do, uma coisa para nao esquecer
- Ligar a alguem, enviar email, pagar algo, comprar algo, tratar de algo
- Exemplo: "Lembra-me de enviar fatura", "Tenho de ligar ao contabilista", "Comprar cafe"

Intents possiveis:
- "check_agenda": ver agenda. params: { "date": "YYYY-MM-DD" } (usa a data atual se nao especificar)
- "check_week": ver a semana. params: { "days": 7 }
- "create_event": EVENTO — compromisso com hora. params: { "summary": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "description": "..." }
  - Se nao disser hora de fim, assume 1 hora depois do inicio
  - Se disser "almoco", assume 12:30-14:00. Se disser "reuniao" sem hora, pergunta.
- "create_reminder": TAREFA — algo para fazer/nao esquecer. params: { "text": "...", "dateTime": "YYYY-MM-DDTHH:MM:00" }
  - Se nao disser hora, assume 09:00 do dia indicado
  - Se nao disser dia, assume hoje
- "list_reminders": ver tarefas/lembretes pendentes. params: {}
- "chat": Conversa normal, nao e um comando. params: {}
  - reply: resposta simpatica e util

Regras:
- Quando diz "amanha", "quinta", "proxima segunda", "dia 20", calcula a data correta baseada na data atual
- Quando diz "as 15h" ou "10h", converte para "15:00" ou "10:00"
- Se disser "marca" ou "agenda" com hora e compromisso = SEMPRE create_event
- Se disser "lembra-me", "nao esquecer", "tenho de", "preciso de" = SEMPRE create_reminder
- Se faltarem dados essenciais (ex: hora para evento), intent="chat" e reply pede os dados em falta
- O reply deve ser uma confirmacao curta e simpatica
- Usa emojis com moderacao (1-2 por mensagem)
- Trata por "tu"

IMPORTANTE: Responde APENAS o JSON, sem markdown, sem backticks. Nunca uses quebras de linha dentro dos valores do JSON.`;
}

const conversationHistory = [];
const MAX_HISTORY = 10;

function addToHistory(role, text) {
  conversationHistory.push({ role, text, time: Date.now() });
  while (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
  while (
    conversationHistory.length > 0 &&
    conversationHistory[0].time < thirtyMinAgo
  ) {
    conversationHistory.shift();
  }
}

function getHistoryText() {
  if (conversationHistory.length === 0) return "";
  return conversationHistory
    .map((h) => {
      const who = h.role === "owner" ? config.OWNER_NAME : "Belz";
      return `${who}: ${h.text}`;
    })
    .join("\n");
}

async function understand(message) {
  addToHistory("owner", message);

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: config.TIMEZONE,
  });
  const timeStr = now.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: config.TIMEZONE,
  });

  const history = getHistoryText();
  const historyBlock = history
    ? `\n\nHistorico recente da conversa:\n${history}\n`
    : "";
  const userMessage = `[Data atual: ${dateStr}, ${timeStr} (${config.TIMEZONE})]${historyBlock}\nMensagem atual: "${message}"`;

  const body = JSON.stringify({
    contents: [
      { role: "user", parts: [{ text: buildSystemPrompt() }] },
      {
        role: "model",
        parts: [{ text: '{"intent":"chat","params":{},"reply":"Entendido!"}' }],
      },
      { role: "user", parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

  try {
    const data = await postJSON(url, body);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    cleaned = cleaned.replace(/\n/g, " ");
    const result = JSON.parse(cleaned);
    log(`AI intent: ${result.intent}`);
    if (result.reply) addToHistory("belz", result.reply);
    return result;
  } catch (err) {
    log(`AI error: ${err.message}`);
    return {
      intent: "chat",
      params: {},
      reply: "Nao percebi bem. Podes repetir?",
    };
  }
}

async function transcribeAudio(audioBuffer) {
  const base64 = audioBuffer.toString("base64");
  const prompt = `Transcreve este audio em portugues. Responde APENAS com o texto transcrito, sem aspas, sem explicacoes. Apenas o que a pessoa disse.`;

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "audio/ogg", data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

  try {
    const data = await postJSON(url, body);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } catch (err) {
    log(`Transcription error: ${err.message}`);
    return null;
  }
}

function postJSON(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy());
    req.write(body);
    req.end();
  });
}

module.exports = { understand, transcribeAudio, addToHistory };
