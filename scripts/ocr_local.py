#!/usr/bin/env python3
"""
OCR local do Jarvis — usa RapidOCR (ONNX Runtime) para extrair texto
de imagens. Suporta manuscrito, imagens giradas e varios idiomas.

Compativel com RapidOCR 3.x (pacote "rapidocr") e com o pacote antigo
"rapidocr-onnxruntime".

Uso:
    python scripts/ocr_local.py <caminho-da-imagem>

Saida:
    Imprime "__OCR_RESULT__<json>" no stdout.
    Imprime logs/erros no stderr.

Estrutura do JSON:
    {
      "text": "texto completo",
      "lines": [{ "text": "...", "score": 0.92 }, ...],
      "confidence": 0.87,
      "elapsed": 1.23
    }

Exit code 0 em sucesso, 1 em erro.
"""

import sys
import json
import time
from pathlib import Path

RESULT_MARKER = "__OCR_RESULT__"


def emit_error(msg):
    print(msg, file=sys.stderr)


def load_engine():
    """Tenta importar RapidOCR 3.x (novo) ou rapidocr_onnxruntime (antigo)."""
    try:
        from rapidocr import RapidOCR  # type: ignore
        return ("new", RapidOCR)
    except ImportError:
        pass

    try:
        from rapidocr_onnxruntime import RapidOCR  # type: ignore
        return ("old", RapidOCR)
    except ImportError:
        pass

    return (None, None)


def empty_result(elapsed=0.0):
    return {"text": "", "lines": [], "confidence": 0.0, "elapsed": elapsed}


def build_result(lines, elapsed):
    if not lines:
        return empty_result(elapsed)
    text = "\n".join(l["text"] for l in lines)
    avg = sum(l["score"] for l in lines) / len(lines)
    return {"text": text, "lines": lines, "confidence": avg, "elapsed": elapsed}


def extract_new_format(engine, image_path):
    """RapidOCR 3.x — API nova. Retorna objeto com .txts / .scores."""
    start = time.time()
    result = engine(str(image_path))
    elapsed = time.time() - start

    if result is None:
        return empty_result(elapsed)

    txts = getattr(result, "txts", None)
    scores = getattr(result, "scores", None)

    # Fallback para versoes intermediarias que retornam (result, elapse)
    if txts is None and isinstance(result, tuple) and len(result) >= 1:
        inner = result[0]
        txts = getattr(inner, "txts", None)
        scores = getattr(inner, "scores", None)

    if txts is None:
        return empty_result(elapsed)

    lines = []
    for i, t in enumerate(txts):
        if not t:
            continue
        score = 0.0
        if scores is not None and i < len(scores):
            try:
                score = float(scores[i])
            except (TypeError, ValueError):
                score = 0.0
        lines.append({"text": str(t).strip(), "score": score})

    return build_result(lines, elapsed)


def extract_old_format(engine, image_path):
    """rapidocr-onnxruntime (API antiga). Retorna [[bbox, texto, score], ...]."""
    start = time.time()
    result, _elapsed = engine(str(image_path), use_det=True, use_cls=True, use_rec=True)
    elapsed = time.time() - start

    if not result:
        return empty_result(elapsed)

    lines = []
    for item in result:
        if len(item) >= 2 and item[1]:
            score = 0.0
            if len(item) >= 3:
                try:
                    score = float(item[2])
                except (TypeError, ValueError):
                    score = 0.0
            lines.append({"text": str(item[1]).strip(), "score": score})

    return build_result(lines, elapsed)


def main():
    if len(sys.argv) < 2:
        emit_error("Informe o caminho da imagem: ocr_local.py <imagem>")
        sys.exit(1)

    image_path = Path(sys.argv[1]).resolve()
    if not image_path.exists():
        emit_error(f"Arquivo nao encontrado: {image_path}")
        sys.exit(1)

    kind, RapidOCR = load_engine()
    if kind is None:
        emit_error(
            "RapidOCR nao instalado.\n"
            "  Instale com: pip install rapidocr onnxruntime"
        )
        sys.exit(1)

    try:
        engine = RapidOCR()
    except Exception as e:
        emit_error(f"Falha ao inicializar RapidOCR: {e}")
        sys.exit(1)

    try:
        if kind == "new":
            result = extract_new_format(engine, image_path)
        else:
            result = extract_old_format(engine, image_path)
    except Exception as e:
        emit_error(f"Falha ao processar a imagem: {e}")
        sys.exit(1)

    print(RESULT_MARKER + json.dumps(result, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()