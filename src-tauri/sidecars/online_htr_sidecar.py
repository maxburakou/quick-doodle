#!/usr/bin/env python3
"""Quick Doodle OnlineHTR sidecar.

Environment:
  QUICK_DOODLE_ONLINE_HTR_REPO: path to a local PellelNitram/OnlineHTR checkout.
  QUICK_DOODLE_ONLINE_HTR_MODEL_DIR: optional path to the unpacked model folder.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from pathlib import Path
from shutil import rmtree
from typing import Any


DEFAULT_MODEL_FOLDER = "models/dataIAMOnDB_featuresLinInterpol20DxDyDtN_decoderGreedy"


def write_response(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


class OnlineHtrEngine:
    def __init__(self) -> None:
        self.error: str | None = None
        self.model = None
        self.decoder = None
        self.alphabet = None
        self.alphabet_mapper = None
        self.transforms = None
        self.data_loader_cls = None
        self.own_dataset_cls = None
        self.collator = None

        try:
            self._load()
        except Exception as exc:  # noqa: BLE001 - sidecar must stay alive.
            self.error = str(exc)

    def _load(self) -> None:
        repo_path = os.environ.get("QUICK_DOODLE_ONLINE_HTR_REPO")
        if not repo_path:
            raise RuntimeError(
                "QUICK_DOODLE_ONLINE_HTR_REPO is not set; point it to a local "
                "PellelNitram/OnlineHTR checkout"
            )

        repo = Path(repo_path).expanduser().resolve()
        if not repo.exists():
            raise RuntimeError(f"OnlineHTR repo not found: {repo}")

        sys.path.insert(0, str(repo))

        import torch
        from torchvision.transforms import transforms
        from torch.utils.data import DataLoader

        from src.data.acquisition import store_strokes
        from src.data.collate_functions import ctc_loss_collator
        from src.data.online_handwriting_datasets import Own_Dataset
        from src.data.tokenisers import AlphabetMapper
        from src.data.transforms import Carbune2020, CharactersToIndices, DictToTensor
        from src.models.carbune_module import LitModule1
        from src.utils.io import get_best_checkpoint_path, load_alphabet

        model_dir = Path(
            os.environ.get("QUICK_DOODLE_ONLINE_HTR_MODEL_DIR")
            or repo / DEFAULT_MODEL_FOLDER
        ).expanduser()
        if not model_dir.exists():
            raise RuntimeError(f"OnlineHTR model folder not found: {model_dir}")

        checkpoint_path = get_best_checkpoint_path(model_dir / "checkpoints")
        self.model = LitModule1.load_from_checkpoint(
            checkpoint_path,
            map_location="cpu",
        )
        self.model.eval()
        self.model.to("cpu")

        checkpoint = torch.load(checkpoint_path, map_location="cpu")
        self.alphabet = load_alphabet(model_dir / "alphabet.json")
        self.alphabet_mapper = AlphabetMapper(self.alphabet)
        self.decoder = checkpoint["hyper_parameters"]["decoder"]
        self.transforms = transforms.Compose(
            [
                Carbune2020(),
                DictToTensor(["x", "y", "t", "n"]),
                CharactersToIndices(self.alphabet),
            ]
        )
        self.data_loader_cls = DataLoader
        self.own_dataset_cls = Own_Dataset
        self.collator = ctc_loss_collator
        self.store_strokes = store_strokes
        self.torch = torch

    @staticmethod
    def _to_online_htr_strokes(strokes: list[dict[str, Any]]) -> list[list[tuple[float, float, float]]]:
        converted: list[list[tuple[float, float, float]]] = []
        first_t: float | None = None
        fallback_t = time.time()

        for stroke in strokes:
            points = stroke.get("points") or []
            converted_stroke: list[tuple[float, float, float]] = []
            for index, point in enumerate(points):
                raw_t = point.get("t")
                if raw_t is None:
                    raw_t = (fallback_t * 1000.0) + index * 16.0
                raw_t = float(raw_t)
                if first_t is None:
                    first_t = raw_t
                converted_stroke.append(
                    (
                        float(point.get("x", 0.0)),
                        -float(point.get("y", 0.0)),
                        (raw_t - first_t) / 1000.0,
                    )
                )
            if converted_stroke:
                converted.append(converted_stroke)

        return converted

    def recognize(self, strokes: list[dict[str, Any]]) -> dict[str, Any]:
        if self.error:
            raise RuntimeError(self.error)
        if not strokes:
            return {"text": "", "alternatives": []}

        tmp_folder = Path(tempfile.mkdtemp(prefix="quick-doodle-online-htr-"))
        try:
            tmp_csv = tmp_folder / "0_TMP.csv"
            self.store_strokes(self._to_online_htr_strokes(strokes), filename=tmp_csv)

            dataset = self.own_dataset_cls(tmp_folder, transform=None)
            if len(dataset) != 1:
                raise RuntimeError(f"expected one OnlineHTR sample, received {len(dataset)}")
            dataset.transform = self.transforms

            data_loader = self.data_loader_cls(
                dataset=dataset,
                batch_size=1,
                num_workers=0,
                pin_memory=False,
                shuffle=False,
                collate_fn=self.collator,
            )
            batch = next(iter(data_loader))

            with self.torch.no_grad():
                log_softmax = self.model(batch["ink"].to("cpu"))

            decoded_texts = self.decoder(log_softmax, self.alphabet_mapper)
            text = decoded_texts[0] if decoded_texts else ""
            return {"text": text, "alternatives": []}
        finally:
            rmtree(tmp_folder, ignore_errors=True)


def main() -> None:
    engine = OnlineHtrEngine()

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request.get("id")
            result = engine.recognize(request.get("strokes") or [])
            write_response(
                {
                    "id": request_id,
                    "text": result.get("text", ""),
                    "alternatives": result.get("alternatives", []),
                }
            )
        except Exception as exc:  # noqa: BLE001 - return errors over protocol.
            write_response(
                {
                    "id": locals().get("request", {}).get("id"),
                    "error": str(exc),
                }
            )


if __name__ == "__main__":
    main()
