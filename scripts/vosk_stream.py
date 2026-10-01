#!/usr/bin/env python3
"""
Vosk Stream — escuta PCM 16kHz mono 16-bit via stdin e detecta a
wake word "jarvis" (e variantes foneticas).

O modelo small-pt NAO tem "jarvis" no vocabulario (nome ingles em
modelo portugues), entao NAO usamos grammar mode. Reconhecemos livre
e fazemos match fuzzy sobre o texto.

Protocolo (stdout):
    READY      -> pronto para receber audio
    __WAKE__   -> wake word detectada
    STOPPED    -> encerrado

Erros vao para stderr. Exit code 0 em sucesso, 1 em erro.

Env vars:
    JARVIS_VOSK_DEBUG=1  -> imprime cada transcricao em stderr
"""

import sys
import os
import json
import re
import signal
import unicodedata

SAMPLE_RATE = 16000
WAKE_MARKER = "__WAKE__"
DEBUG = os.environ.get("JARVIS_VOSK_DEBUG") == "1"

# Variantes foneticas de "jarvis" que o Vosk pode produzir em PT.
# Ordem importa apenas para debug; o match e por presenca.
WAKE_VARIANTS = [
    "jarvis",
    "jarvi",
    "jarvisk",
    "jervis",
    "jervi",
    "jarvs",
    "jarves",
    "jarvez",
    "jarviz",
    "jarwis",
    "jarvys",
    "jardis",
    "jardi",
    "jardim",
    "jardins",
    "jarbas",
]


def emit_error(msg):
    print(msg, file=sys.stderr, flush=True)


def normalize_text(text):
    """Remove acentos e coloca em minusculas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def is_wake_match(text):
    """
    Retorna True se o texto contem alguma variante da wake word.
    Usa match por palavra (\b) para evitar falsos positivos em
    palavras que apenas contem a variante como substring.
    """
    if not text:
        return False
    norm = normalize_text(text)
    for variant in WAKE_VARIANTS:
        # \b funciona com letras latinas apos normalizacao
        if re.search(r"\b" + re.escape(variant) + r"\b", norm):
            return True
    return False


def main():
    if len(sys.argv) < 2:
        emit_error("Informe o caminho do modelo: vosk_stream.py <modelo>")
        sys.exit(1)

    model_path = sys.argv[1]

    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError:
        emit_error(
            "Pacote 'vosk' nao instalado.\n"
            "  Instale com: pip install vosk"
        )
        sys.exit(1)

    SetLogLevel(-1)

    try:
        model = Model(model_path)
    except Exception as e:
        emit_error(f"Falha ao carregar modelo Vosk: {e}")
        sys.exit(1)

    rec = KaldiRecognizer(model, SAMPLE_RATE)

    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
    except Exception:
        pass

    stdin = sys.stdin.buffer
    print("READY", flush=True)

    # Debounce: nao dispara wake duas vezes em menos de 1.5s
    last_wake_at = 0.0
    import time as _time

    def maybe_emit_wake(text):
        nonlocal last_wake_at
        if not is_wake_match(text):
            return
        now = _time.time()
        if now - last_wake_at < 1.5:
            return
        last_wake_at = now
        print(WAKE_MARKER, flush=True)

    while True:
        try:
            data = stdin.read(4000)
        except Exception:
            break

        if not data:
            break

        try:
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text = result.get("text", "")
                if DEBUG and text:
                    emit_error(f"[vosk final] {text}")
                maybe_emit_wake(text)
            else:
                partial = json.loads(rec.PartialResult())
                partial_text = partial.get("partial", "")
                if DEBUG and partial_text:
                    emit_error(f"[vosk partial] {partial_text}")
                maybe_emit_wake(partial_text)
        except Exception as e:
            emit_error(f"Erro durante reconhecimento: {e}")
            continue

    print("STOPPED", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
