# Como instalar a tua assistente (super simples)

Esta skill é o teu guia. Depois de instalada, o Claude faz-te todas as perguntas e põe a tua assistente a funcionar — incluindo escolheres o nome dela (podes manter "Belz" ou dar o teu próprio).

## Antes de começar

Confirma que tens o **Claude Code** instalado e com sessão iniciada.
Se ainda não tens: https://claude.com/claude-code

---

## Instalação (2 minutos)

### Passo 1 — Descarregar a skill

Descarrega o ficheiro `belz-mentoradas-skill.zip` (a Isabel envia-te). Repara onde ele ficou (normalmente na pasta **Transferências/Downloads**).

### Passo 2 — Pedir ao Claude para instalar

Abre o **Claude Code** e escreve uma mensagem assim (ajusta o nome da pasta se for preciso):

> Tenho o ficheiro `belz-mentoradas-skill.zip` na pasta Downloads. Instala-me essa skill: descompacta-a e põe a pasta `belz-mentoradas` dentro de `~/.claude/skills/`.

O Claude trata de tudo sozinho (descompacta e coloca no sítio certo). Se ele perguntar onde está o ficheiro, diz-lhe o caminho (ex: `~/Downloads/belz-mentoradas-skill.zip`).

### Passo 3 — Reabrir o Claude Code

Fecha completamente o Claude Code e abre de novo (para ele ler a nova skill).

### Passo 4 — Criar a tua assistente

No Claude Code, escreve:

> quero criar a minha assistente

A partir daí o Claude conduz-te pelo setup completo (~30 minutos), uma pergunta de cada vez. A **primeira** coisa que te vai perguntar é o **nome** que queres dar à tua assistente. 😊

---

## Preferes fazer à mão?

Se quiseres instalar manualmente em vez de pedir ao Claude:

1. Descompacta o `belz-mentoradas-skill.zip` → ficas com uma pasta `belz-mentoradas`
2. Move essa pasta para `~/.claude/skills/`
3. No fim deves ter: `~/.claude/skills/belz-mentoradas/SKILL.md`
4. Reabre o Claude Code

---

## Não está a funcionar?

- **"Skill não aparece"** → Confirma que o ficheiro está em `~/.claude/skills/belz-mentoradas/SKILL.md` (não dentro de outra subpasta). Reabre o Claude Code.
- **"Não tenho Claude Code"** → Instala em https://claude.com/claude-code
- **"Apareceu um erro"** → Manda print à Isabel.

Boa sorte!
