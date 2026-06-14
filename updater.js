// === AUTO-UPDATE ===
// A Belz mantem-se atualizada sozinha. Uma vez por dia (e no arranque) verifica
// se a Isabel publicou novidades no repo. Se sim: puxa o codigo, instala
// dependencias novas, avisa a aluna no Telegram e reinicia-se.
//
// - Em VPS com PM2: o reinicio e automatico e transparente (process.exit -> PM2
//   volta a arrancar com o codigo novo).
// - Em PC (sem supervisor): puxa o codigo na mesma e avisa a aluna para reabrir.

const { exec } = require("child_process");
const path = require("path");
const { log } = require("./utils");

const REPO_DIR = __dirname;

function run(cmd, timeoutMs = 120000) {
  return new Promise((resolve) => {
    exec(
      cmd,
      { cwd: REPO_DIR, timeout: timeoutMs, maxBuffer: 1024 * 1024 * 8 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: (stdout || "").trim(),
          stderr: (stderr || "").trim(),
        });
      },
    );
  });
}

// Esta a correr sob PM2? (consegue reiniciar-se sozinha)
function isUnderPM2() {
  return !!(process.env.pm_id || process.env.PM2_HOME || process.env.PM2_USAGE);
}

// Verifica se ha update e aplica-o. notify(texto) envia mensagem a aluna.
async function checkAndUpdate(notify) {
  // So funciona se isto for um repositorio git (clone). Se nao for, ignora.
  const isRepo = await run("git rev-parse --is-inside-work-tree");
  if (!isRepo.ok || isRepo.stdout !== "true") {
    log("[UPDATE] Nao e um repo git, auto-update desativado.");
    return { updated: false };
  }

  const branchRes = await run("git rev-parse --abbrev-ref HEAD");
  const branch = branchRes.ok && branchRes.stdout ? branchRes.stdout : "main";

  // Vai buscar o estado remoto sem alterar nada local
  const fetch = await run(`git fetch origin ${branch}`);
  if (!fetch.ok) {
    log(`[UPDATE] git fetch falhou: ${fetch.stderr}`);
    return { updated: false };
  }

  const local = await run("git rev-parse HEAD");
  const remote = await run(`git rev-parse origin/${branch}`);
  if (!local.ok || !remote.ok) return { updated: false };

  if (local.stdout === remote.stdout) {
    log("[UPDATE] Ja estas na versao mais recente.");
    return { updated: false };
  }

  log("[UPDATE] Ha novidades! A atualizar...");

  // Mensagens dos commits novos, para contar a aluna o que mudou
  const logRes = await run(
    `git log --no-merges --pretty=format:%s HEAD..origin/${branch}`,
  );
  const changes = (logRes.stdout || "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^(feat|fix|add|chore|docs|refactor)(\([^)]*\))?:\s*/i, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 6);

  // Saber se as dependencias mudaram (para correr npm install so se preciso)
  const pkgChanged = await run(
    `git diff --name-only HEAD origin/${branch} -- package.json package-lock.json`,
  );
  const needsInstall = !!(pkgChanged.stdout && pkgChanged.stdout.length);

  // Aplica o codigo novo. --ff-only evita merges acidentais; os ficheiros da
  // aluna (.env, oauth-token.json, doc-config.json, reminders.json) estao todos
  // no .gitignore, por isso nao ha conflitos.
  const pull = await run(`git pull --ff-only origin ${branch}`);
  if (!pull.ok) {
    log(`[UPDATE] git pull falhou: ${pull.stderr}`);
    if (notify) {
      await notify(
        "Tentei atualizar-me mas houve um problema. Avisa a Isabel, por favor.",
      ).catch(() => {});
    }
    return { updated: false, error: pull.stderr };
  }

  if (needsInstall) {
    log("[UPDATE] package.json mudou, a correr npm install...");
    const install = await run(
      "npm install --omit=dev --no-audit --no-fund",
      180000,
    );
    if (!install.ok) log(`[UPDATE] npm install aviso: ${install.stderr}`);
  }

  const changeList = changes.length
    ? "\n\n*Novidades:*\n" + changes.map((c) => `- ${c}`).join("\n")
    : "";

  if (isUnderPM2()) {
    if (notify) {
      await notify(
        `Atualizei-me com novidades da Isabel! 🎉${changeList}\n\n_A reiniciar..._`,
      ).catch(() => {});
    }
    log("[UPDATE] Atualizado. A reiniciar (PM2)...");
    // Da tempo a mensagem sair antes de sair do processo
    setTimeout(() => process.exit(0), 1500);
    return { updated: true, restarting: true };
  }

  // PC sem supervisor: o codigo ja esta atualizado, mas so entra em vigor ao reabrir
  if (notify) {
    await notify(
      `Recebi novidades da Isabel! 🎉${changeList}\n\n` +
        "Para as ativar, fecha-me (Ctrl+C no terminal) e abre de novo com *npm start*.",
    ).catch(() => {});
  }
  log("[UPDATE] Atualizado. Aguarda reinicio manual (PC).");
  return { updated: true, restarting: false };
}

module.exports = { checkAndUpdate, isUnderPM2 };
