# Online HTR Assets

This folder is the project-owned source for OnlineHTR runtime assets:

- `model.onnx`
- `alphabet.json`

These files are committed product assets and are referenced from app code
through Vite's asset graph. In dev, Vite serves them from this folder. In
production builds, Vite copies them into `dist/assets/` with generated
filenames.

End users never install Python, PyTorch, OnlineHTR, or generate anything. The
export script is only for maintainers who need to recreate these assets from a
local PellelNitram/OnlineHTR checkout:

```sh
python scripts/export_online_htr_onnx.py --online-htr-repo /path/to/OnlineHTR
```
