// === ORGANIZACAO DE DOCUMENTOS ===
// A aluna envia uma foto ou PDF pelo Telegram. A IA le e classifica numa das
// categorias que ELA escolheu, e guarda no Google Drive dela, na pasta certa.
// Tudo via OAuth (a mesma conta do Calendar). Sem servidores externos.

const { google } = require("googleapis");
const fs = require("fs");
const { Readable } = require("stream");
const config = require("./config");
const { log } = require("./utils");
const { getAuth } = require("./calendar");
const { classifyDocument } = require("./ai");

// --- Config persistente da organizacao (criada no setup conversacional) ---
// {
//   configured: true,
//   folderName: "Documentos Belz",
//   rootFolderId: "abc...",
//   categories: ["Banco","Estado","Fornecedores","Vendas"],
//   byMonth: true
// }
function loadDocConfig() {
  try {
    return JSON.parse(fs.readFileSync(config.DOC_CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveDocConfig(cfg) {
  fs.writeFileSync(config.DOC_CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function isConfigured() {
  const cfg = loadDocConfig();
  return !!(cfg && cfg.configured);
}

const DEFAULT_CATEGORIES = ["Banco", "Estado", "Fornecedores", "Vendas"];
const DEFAULT_FOLDER_NAME = `Documentos ${config.ASSISTANT_NAME}`;

// --- Drive helpers (OAuth da aluna) ---
function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

async function getOrCreateFolder(drive, name, parentId) {
  const safeName = name.replace(/'/g, "\\'");
  const q = parentId
    ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false and 'root' in parents`;

  const res = await drive.files.list({ q, fields: "files(id,name)" });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

  const resource = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) resource.parents = [parentId];

  const folder = await drive.files.create({ resource, fields: "id" });
  log(`[DOCS] Pasta criada no Drive: ${name}`);
  return folder.data.id;
}

// Cria a pasta raiz + uma subpasta por categoria. Devolve o id da raiz.
async function ensureFolderStructure(cfg) {
  const drive = getDrive();
  const rootId = await getOrCreateFolder(drive, cfg.folderName, null);
  for (const cat of cfg.categories) {
    await getOrCreateFolder(drive, cat, rootId);
  }
  // Pasta de seguranca para o que a IA nao conseguir classificar
  await getOrCreateFolder(drive, "Outros", rootId);
  return rootId;
}

function monthLabel(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeCategory(cat, categories) {
  if (!cat) return "Outros";
  const match = categories.find(
    (c) => c.toLowerCase() === String(cat).toLowerCase(),
  );
  return match || "Outros";
}

const EXT_MIME = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  heic: "image/heic",
  webp: "image/webp",
};

async function findExistingFile(drive, folderId, name, size) {
  try {
    const safeName = name.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name='${safeName}' and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      fields: "files(id,name,size)",
      pageSize: 5,
    });
    const files = res.data.files || [];
    if (!files.length) return null;
    if (size != null) {
      return files.find((f) => Number(f.size) === Number(size)) || null;
    }
    return files[0];
  } catch {
    return null;
  }
}

// Processa um documento: classifica e guarda na pasta certa do Drive da aluna.
async function processDocument(imageBuffer, fileName) {
  const cfg = loadDocConfig();
  if (!cfg || !cfg.configured) {
    return { success: false, needsSetup: true };
  }

  log(`[DOCS] A processar documento: ${fileName}`);

  const classification = await classifyDocument(
    imageBuffer,
    fileName,
    cfg.categories,
  );

  if (!classification) {
    return {
      success: false,
      message:
        "Nao consegui ler o documento. Tenta enviar uma foto com melhor qualidade ou o PDF original.",
    };
  }

  const drive = getDrive();
  const category = normalizeCategory(classification.category, cfg.categories);

  // Garante que a pasta raiz existe (guarda o id para nao procurar sempre)
  let rootId = cfg.rootFolderId;
  if (!rootId) {
    rootId = await getOrCreateFolder(drive, cfg.folderName, null);
    cfg.rootFolderId = rootId;
    saveDocConfig(cfg);
  }

  let targetId = await getOrCreateFolder(drive, category, rootId);
  let pathLabel = category;

  if (cfg.byMonth) {
    const ml = monthLabel(classification.date);
    targetId = await getOrCreateFolder(drive, ml, targetId);
    pathLabel = `${category}/${ml}`;
  }

  // Evita guardar o mesmo ficheiro duas vezes
  const existing = await findExistingFile(
    drive,
    targetId,
    fileName,
    imageBuffer.length,
  );

  const summary = classification.summary || "documento";
  const total = classification.total ? ` (${classification.total})` : "";

  if (existing) {
    log(`[DOCS] Ja existia: ${fileName} em ${pathLabel} (nao dupliquei)`);
    return {
      success: true,
      duplicate: true,
      message: `Ja tinhas guardado "${summary}"${total} em *${pathLabel}* ✓`,
    };
  }

  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const mimeType = EXT_MIME[ext] || "application/octet-stream";

  const stream = new Readable();
  stream.push(imageBuffer);
  stream.push(null);

  await drive.files.create({
    resource: { name: fileName, parents: [targetId] },
    media: { mimeType, body: stream },
    fields: "id,name",
  });

  log(`[DOCS] Guardado: ${fileName} → ${pathLabel}`);

  return {
    success: true,
    message: `Guardei "${summary}"${total} em *${pathLabel}* ✓`,
  };
}

// === SETUP CONVERSACIONAL ===
// Estado em memoria enquanto a aluna configura. Single-owner, por isso chega.
let setupState = null;

function isAwaitingSetup() {
  return setupState !== null;
}

function startSetup() {
  setupState = { step: "folder", draft: {} };
  return (
    "Vamos organizar os teus documentos! 📂\n\n" +
    "Quando me enviares uma foto ou PDF (faturas, recibos, etc.), eu leio, percebo o que e e guardo na pasta certa do *teu* Google Drive.\n\n" +
    "*1.* Como queres chamar a pasta principal onde vou guardar tudo?\n" +
    `Responde com o nome, ou escreve *sugere* para usar "${DEFAULT_FOLDER_NAME}".`
  );
}

// Recebe a resposta da aluna durante o setup. Devolve o texto a enviar de volta.
async function handleSetupReply(text) {
  const answer = (text || "").trim();
  const suggest = /^sugere$/i.test(answer);

  if (setupState.step === "folder") {
    setupState.draft.folderName = suggest ? DEFAULT_FOLDER_NAME : answer;
    setupState.step = "categories";
    return (
      `Boa, vou usar a pasta *${setupState.draft.folderName}*.\n\n` +
      "*2.* Que categorias queres para arrumar os documentos?\n" +
      "Escreve-as separadas por virgula.\n" +
      `Exemplo: _Banco, Estado, Fornecedores, Vendas_\n\n` +
      `Ou escreve *sugere* para usar estas 4.`
    );
  }

  if (setupState.step === "categories") {
    let cats;
    if (suggest) {
      cats = DEFAULT_CATEGORIES.slice();
    } else {
      cats = answer
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        // Capitaliza a 1a letra de cada categoria
        .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
    }
    if (cats.length === 0) {
      return "Nao percebi as categorias. Escreve-as separadas por virgula, ou *sugere*.";
    }
    setupState.draft.categories = cats;
    setupState.step = "bymonth";
    return (
      `Categorias: *${cats.join(", ")}*.\n\n` +
      "*3.* Queres que eu organize tambem por mes (subpastas tipo _2026-06_ dentro de cada categoria)?\n" +
      "Responde *sim* ou *nao*."
    );
  }

  if (setupState.step === "bymonth") {
    const byMonth = /^(s|sim|yes|y)/i.test(answer);
    const cfg = {
      configured: true,
      folderName: setupState.draft.folderName,
      categories: setupState.draft.categories,
      byMonth,
      rootFolderId: null,
    };

    try {
      cfg.rootFolderId = await ensureFolderStructure(cfg);
    } catch (err) {
      log(`[DOCS] Erro a criar pastas: ${err.message}`);
      setupState = null;
      return (
        "Configurei as categorias, mas nao consegui criar as pastas no Drive agora. " +
        "Vou cria-las automaticamente quando enviares o primeiro documento."
      );
    }

    saveDocConfig(cfg);
    setupState = null;

    const monthMsg = byMonth ? " e por mes" : "";
    return (
      "Tudo pronto! ✅\n\n" +
      `Criei a pasta *${cfg.folderName}* no teu Drive, com as categorias ${cfg.categories
        .map((c) => `_${c}_`)
        .join(", ")}${monthMsg}.\n\n` +
      "Agora e so enviares-me uma foto ou PDF de um documento que eu trato de o arrumar. 📎"
    );
  }

  // Estado inesperado — reinicia
  setupState = null;
  return "Algo correu mal na configuracao. Escreve /documentos para recomecar.";
}

// Mostra a configuracao atual de forma legivel
function describeConfig() {
  const cfg = loadDocConfig();
  if (!cfg || !cfg.configured) return null;
  const monthMsg = cfg.byMonth ? " (organizados por mes)" : "";
  return (
    `📂 *Os teus documentos*\n\n` +
    `Pasta: *${cfg.folderName}*\n` +
    `Categorias: ${cfg.categories.map((c) => `_${c}_`).join(", ")}${monthMsg}\n\n` +
    `Envia-me uma foto ou PDF que eu arrumo.\n` +
    `Para mudar as categorias, escreve /documentos.`
  );
}

module.exports = {
  processDocument,
  isConfigured,
  isAwaitingSetup,
  startSetup,
  handleSetupReply,
  describeConfig,
};
