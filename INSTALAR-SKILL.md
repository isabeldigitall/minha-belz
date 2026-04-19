# Como instalar a skill "Minha Belz" no teu Claude Code

A skill é o teu guia passo-a-passo para criar a tua própria assistente Telegram. Depois de instalada, basta dizeres ao Claude Code "quero criar a minha assistente" e ela conduz-te por tudo.

## Antes de começar

Confirma que tens o **Claude Code** instalado e com sessão iniciada.
Se ainda não tens: https://claude.com/claude-code

---

## Instalação (5 minutos)

### Passo 1 — Descarregar a skill

Descarrega o ficheiro `belz-mentoradas-skill.zip` (a Isabel envia-te por WhatsApp ou email).

### Passo 2 — Encontrar a pasta de skills do Claude Code

Abre o **Terminal** (Mac) ou **PowerShell** (Windows) e cola:

**Mac / Linux:**

```bash
mkdir -p ~/.claude/skills && open ~/.claude/skills
```

**Windows (PowerShell):**

```powershell
mkdir -Force "$HOME\.claude\skills"; explorer "$HOME\.claude\skills"
```

Vai abrir uma janela do Finder/Explorador na pasta certa.

### Passo 3 — Descompactar e mover

1. Descompacta o `belz-mentoradas-skill.zip` (clica duas vezes no Mac, botão direito → Extrair no Windows)
2. Vais ficar com uma pasta chamada `belz-mentoradas`
3. **Arrasta essa pasta para a janela aberta no Passo 2** (a pasta `~/.claude/skills/`)

No fim deves ter:

```
~/.claude/skills/belz-mentoradas/SKILL.md
```

### Passo 4 — Verificar

No terminal, cola:

**Mac / Linux:**

```bash
ls ~/.claude/skills/belz-mentoradas/
```

**Windows:**

```powershell
dir "$HOME\.claude\skills\belz-mentoradas"
```

Deves ver `SKILL.md` listado. Se sim, está instalada.

### Passo 5 — Reabrir o Claude Code

Fecha completamente o Claude Code e abre de novo (para ele ler a nova skill).

### Passo 6 — Usar

No Claude Code, escreve:

> quero criar a minha assistente

A Belz Mentoradas vai começar a conduzir-te pelo setup completo (~30 minutos). Aproveita!

---

## Não está a funcionar?

- **"Skill não aparece"** → Confirma que o ficheiro está em `~/.claude/skills/belz-mentoradas/SKILL.md` (não dentro de outra subpasta). Reabre o Claude Code.
- **"Não tenho Claude Code"** → Instala em https://claude.com/claude-code
- **"Apareceu um erro"** → Manda print à Isabel.

Boa sorte!
