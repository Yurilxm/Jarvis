#!/usr/bin/env python3
"""
Vosk Stream - escuta PCM 16kHz mono 16-bit via stdin e detecta a
wake word "jarvis" (ou, em modo CANCEL, frases de cancelamento).

Protocolo de stdin (apos este patch):
    LEN:<n>\n<bytes>   -> n bytes de audio PCM (16kHz mono 16-bit LE)
    CMD:mode\n         -> "mode" pode ser "wake" ou "cancel"

Sem prefixo, o Python assume bytes brutos (compat com versoes antigas).

Protocolo de stdout:
    READY      -> pronto para receber audio
    __WAKE__   -> wake word detectada (modo wake)
    __CANCEL__ -> pedido de cancelamento detectado (modo cancel)
    STOPPED    -> encerrado

Erros vao para stderr. Exit code 0 em sucesso, 1 em erro.
"""

import sys
import os
import io
import json
import re
import signal
import time
import unicodedata

SAMPLE_RATE = 16000
WAKE_MARKER = "__WAKE__"
CANCEL_MARKER = "__CANCEL__"
DEBUG = os.environ.get("JARVIS_VOSK_DEBUG") == "1"

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

CANCEL_WORDS = [
    "para",
    "pare",
    "chega",
    "cala",
    "quieto",
    "quieta",
    "silencio",
    "silencia",
    "desliga",
    "desligar",
    "basta",
]


def emit_error(msg):
    print(msg, file=sys.stderr, flush=True)


def normalize_text(text):
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def _has_any(text, variants):
    if not text:
        return False
    for v in variants:
        if re.search(r"\b" + re.escape(v) + r"\b", text):
            return True
    return False


def is_wake_match(text):
    return _has_any(normalize_text(text), WAKE_VARIANTS)


def is_cancel_match(text):
    norm = normalize_text(text)
    if not _has_any(norm, WAKE_VARIANTS):
        return False
    return _has_any(norm, CANCEL_WORDS)


def read_line(buffered):
    line = b""
    while True:
        c = buffered.read(1)
        if not c:
            return None
        if c == b"\n":
            return line
        line += c
        if len(line) > 256:
            return None


def main():
    if len(sys.argv) < 2:
        emit_error("Informe o caminho do modelo: vosk_stream.py <modelo>")
        sys.exit(1)

    model_path = sys.argv[1]

    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError:
        emit_error("Pacote 'vosk' nao instalado. Instale com: pip install vosk")
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

    # Envolve stdin em BufferedReader pra read(1) ser barato
    raw_stdin = sys.stdin.buffer
    buffered = io.BufferedReader(raw_stdin, buffer_size=65536)

    mode = "wake"
    last_emit_at = 0.0

    print("READY", flush=True)

    def maybe_emit(text):
        nonlocal last_emit_at
        if mode == "wake":
            if not is_wake_match(text):
                return
            marker = WAKE_MARKER
        else:  # cancel
            if not is_cancel_match(text):
                return
            marker = CANCEL_MARKER

        now = time.time()
        if now - last_emit_at < 1.5:
            return
        last_emit_at = now
        print(marker, flush=True)

    while True:
        raw_line = read_line(buffered)
        if raw_line is None:
            break

        try:
            line = raw_line.decode("ascii", errors="ignore").strip()
        except Exception:
            continue

        if line.startswith("CMD:"):
            new_mode = line[4:].strip().lower()
            if new_mode in ("wake", "cancel"):
                mode = new_mode
            continue

        if line.startswith("LEN:"):
            try:
                n = int(line[4:])
            except ValueError:
                continue
            data = b""
            remaining = n
            while remaining > 0:
                chunk = buffered.read(remaining)
                if not chunk:
                    break
                data += chunk
                remaining -= len(chunk)
            if len(data) < n:
                break
        else:
            # Compat: se a linha nao tem prefixo, o buffer inteiro e' audio
            data = raw_line

        if not data:
            continue

        try:
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text = result.get("text", "")
                if DEBUG and text:
                    emit_error(f"[vosk final:{mode}] {text}")
                maybe_emit(text)
            else:
                partial = json.loads(rec.PartialResult())
                partial_text = partial.get("partial", "")
                if DEBUG and partial_text:
                    emit_error(f"[vosk partial:{mode}] {partial_text}")
                maybe_emit(partial_text)
        except Exception as e:
            emit_error(f"Erro durante reconhecimento: {e}")
            continue

    print("STOPPED", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()
