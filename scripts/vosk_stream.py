#!/usr/bin/env python3
"""
Vosk Stream — escuta PCM 16kHz mono 16-bit via stdin e detecta a
wake word "jarvis" (e variantes). Imprime "__WAKE__" no stdout quando
detecta.

Uso:
    python scripts/vosk_stream.py <caminho-do-modelo>

Protocolo:
    stdin:  bytes PCM s16le, 16kHz, mono (sem header)
    stdout: uma linha por evento ("__WAKE__\\n" quando detecta)
    stderr: logs e erros

Exit code 0 em sucesso, 1 em erro.
"""

import sys
import json
import signal

SAMPLE_RATE = 16000
WAKE_MARKER = "__WAKE__"

# Frases aceitas como wake word. Vosk vai interpretar a fala e casar
# contra essa lista; "[unk]" captura tudo o que não bater.
WAKE_PHRASES = [
    "jarvis",
    "ei jarvis",
    "oi jarvis",
    "ola jarvis",
    "hey jarvis",
    "[unk]",
]


def emit(msg):
    print(msg, file=sys.stderr, flush=True)


def run(model_path):
    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except ImportError:
        emit(
            "Pacote 'vosk' nao instalado.\n"
            "  Instale com: pip install vosk"
        )
        sys.exit(1)

    # Silencia logs internos do Vosk
    SetLogLevel(-1)

    try:
        model = Model(model_path)
    except Exception as e:
        emit(f"Falha ao carregar modelo Vosk: {e}")
        sys.exit(1)

    grammar = json.dumps(WAKE_PHRASES, ensure_ascii=False)
    rec = KaldiRecognizer(model, SAMPLE_RATE, grammar)

    emit("READY")

    # Ignora SIGINT no filho — o pai controla o ciclo de vida
    signal.signal(signal.SIGINT, signal.SIG_IGN)

    stdin = sys.stdin.buffer

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
                text = (result.get("text") or "").lower()
                if any(p in text for p in ("jarvis",)):
                    print(WAKE_MARKER, flush=True)
                    try:
                        rec.Reset()
                    except AttributeError:
                        # Algumas versões não expõem Reset — recria
                        rec = KaldiRecognizer(model, SAMPLE_RATE, grammar)
            else:
                partial = json.loads(rec.PartialResult())
                text = (partial.get("partial") or "").lower()
                if "jarvis" in text:
                    print(WAKE_MARKER, flush=True)
                    try:
                        rec.Reset()
                    except AttributeError:
                        rec = KaldiRecognizer(model, SAMPLE_RATE, grammar)
        except Exception as e:
            emit(f"Erro durante reconhecimento: {e}")
            continue

    emit("STOPPED")
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        emit("Informe o caminho do modelo: vosk_stream.py <modelo>")
        sys.exit(1)

    model_path = sys.argv[1]
    run(model_path)


if __name__ == "__main__":
    main()