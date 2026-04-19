const http = require("http");
const { google } = require("googleapis");
const fs = require("fs");
const config = require("./config");

const PORT = 4567;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

const oauth2Client = new google.auth.OAuth2(
  config.GOOGLE_CLIENT_ID,
  config.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI,
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>Erro</h1><p>${error}</p>`);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(config.OAUTH_TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>Tudo certo!</h1>
        <p>Token guardado. Podes fechar esta janela e voltar ao terminal.</p>
      </body></html>
    `);
    console.log("\nToken Google guardado em", config.OAUTH_TOKEN_PATH);
    console.log("Agora corre: npm start\n");
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 1000);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>Erro a obter token</h1><pre>${err.message}</pre>`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("\n=== Setup OAuth Google ===\n");
  console.log("1. Vai abrir o teu browser");
  console.log(
    "2. Faz login com a conta Google que queres usar (" +
      config.GOOGLE_EMAIL +
      ")",
  );
  console.log('3. Se aparecer "App nao verificada" -> Avancado -> Continuar');
  console.log("4. Aceita os 3 acessos (Calendar, Drive, Email)");
  console.log("5. Voltas automaticamente para aqui\n");
  console.log("URL de autenticacao:");
  console.log(authUrl + "\n");

  const { exec } = require("child_process");
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} "${authUrl}"`);
});
