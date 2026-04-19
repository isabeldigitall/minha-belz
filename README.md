# Minha Belz

A tua assistente pessoal via Telegram. Responde a mensagens de texto e voz em português, marca eventos no Google Calendar, gere lembretes e envia-te todas as manhãs o resumo do dia.

## O que precisas

1. Conta Google (Gmail ou Workspace)
2. Conta Telegram
3. Cartão de crédito (para ativar billing no Google Cloud — custo real: cêntimos/mês)
4. Node.js 20+ instalado

## Setup rápido

A forma mais fácil é usares a skill **`belz-mentoradas`** no Claude Code — ela guia-te passo a passo por tudo.

Se preferires fazer manual, segue o `SETUP.md`.

## Como correr

```bash
npm install
cp .env.example .env
# preenche o .env com os teus dados
npm run setup    # autentica Google OAuth (abre browser)
npm start        # arranca a Belz
```

Depois envia `/start` ao teu bot no Telegram.

## O que a Belz sabe fazer

- "O que tenho amanhã?" — vê a agenda
- "O que tenho esta semana?" — próximos 7 dias
- "Marca reunião com a Maria dia 25 às 15h" — cria evento no Calendar
- "Lembra-me de pagar a luz na sexta" — cria lembrete (notifica no Telegram)
- "Que lembretes tenho?" — lista pendentes
- Áudios funcionam igual a texto (transcreve com Gemini)

## Licença

MIT
