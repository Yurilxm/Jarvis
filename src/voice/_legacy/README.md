# `_legacy/` — Código legado do Jarvis Voz

Esta pasta contém código que está **mantido por compatibilidade**, mas que
**não é o caminho principal** do Jarvis Voz.

## `wakeword.js` (Porcupine / Picovoice)

**Status:** experimental / legacy. Não usar como referência.

**Motivo de estar aqui:**
- A Picovoice fechou o free tier do console para e-mails pessoais
- Sem conta paga, não é possível gerar a AccessKey necessária
- O modo `jarvis voz --wake` só funciona com conta paga

**O que substitui:**
- Vosk (open source, offline, sem API key) — ver etapa E do roadmap

**Ainda é útil para:**
- `frameSplitter` — função genérica de split de PCM em frames, reaproveitável
  por qualquer sistema frame-based (incluindo Vosk no futuro)

**Se você quiser usar mesmo assim:**
1. Crie conta paga em https://console.picovoice.ai/
2. Gere uma AccessKey
3. Adicione ao `~/.jarvis-dev/.env`: PICOVOICE_ACCESS_KEY=sua-chave
4. Rode `jarvis voz --wake`

## Quando esta pasta pode ser deletada

Quando o Vosk estiver implementado e funcionando (etapa E concluída).
Nessa hora, o único arquivo que ainda pode ter valor é o `frameSplitter`,
que pode ser movido para `src/voice/capture.js` antes de deletar a pasta.