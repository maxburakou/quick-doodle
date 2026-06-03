#!/usr/bin/env python3
"""Export PellelNitram/OnlineHTR checkpoint to Quick Doodle ONNX assets.

Example:
  python scripts/export_online_htr_onnx.py \
    --online-htr-repo ~/Projects/OnlineHTR \
    --model-dir ~/Projects/OnlineHTR/models/dataIAMOnDB_featuresLinInterpol20DxDyDtN_decoderGreedy
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


DEFAULT_MODEL_DIR = "models/dataIAMOnDB_featuresLinInterpol20DxDyDtN_decoderGreedy"
DEFAULT_OUTPUT_DIR = ".disk/models/online-htr"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--online-htr-repo",
        required=True,
        type=Path,
        help="Path to a local PellelNitram/OnlineHTR checkout.",
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        help=f"Path to unpacked model folder. Defaults to repo/{DEFAULT_MODEL_DIR}.",
    )
    parser.add_argument(
        "--output-dir",
        default=Path(DEFAULT_OUTPUT_DIR),
        type=Path,
        help=f"Output asset folder. Defaults to {DEFAULT_OUTPUT_DIR}.",
    )
    parser.add_argument("--opset", default=17, type=int)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    repo = args.online_htr_repo.expanduser().resolve()
    model_dir = (args.model_dir or repo / DEFAULT_MODEL_DIR).expanduser().resolve()
    output_dir = args.output_dir.resolve()

    if not repo.exists():
        raise SystemExit(f"OnlineHTR repo not found: {repo}")
    if not model_dir.exists():
        raise SystemExit(f"OnlineHTR model folder not found: {model_dir}")

    sys.path.insert(0, str(repo))

    import torch

    from src.models.carbune_module import LitModule1
    from src.utils.io import get_best_checkpoint_path

    checkpoint_path = get_best_checkpoint_path(model_dir / "checkpoints")
    model = LitModule1.load_from_checkpoint(
        checkpoint_path,
        map_location="cpu",
        weights_only=False,
    )
    model.eval()
    model.to("cpu")

    output_dir.mkdir(parents=True, exist_ok=True)
    onnx_path = output_dir / "model.onnx"
    alphabet_path = model_dir / "alphabet.json"
    if not alphabet_path.exists():
        raise SystemExit(f"alphabet.json not found: {alphabet_path}")

    dummy_ink = torch.zeros((64, 1, 4), dtype=torch.float32)
    torch.onnx.export(
        model,
        (dummy_ink,),
        onnx_path,
        input_names=["ink"],
        output_names=["log_softmax"],
        dynamic_axes={
            "ink": {0: "sequence_length"},
            "log_softmax": {0: "sequence_length"},
        },
        opset_version=args.opset,
    )
    shutil.copyfile(alphabet_path, output_dir / "alphabet.json")

    print(f"Wrote {onnx_path}")
    print(f"Wrote {output_dir / 'alphabet.json'}")


if __name__ == "__main__":
    main()
