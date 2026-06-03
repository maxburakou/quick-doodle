# Online HTR Assets

This folder is the project-owned source for OnlineHTR runtime assets:

- `model.onnx`
- `alphabet.json`

These files are product assets. They should be present before packaging the app,
so end users never install Python, PyTorch, OnlineHTR, or generate anything.

`npm run htr:prepare` copies these files into `public/models/online-htr/` for
Vite/Tauri. If they are missing locally and `QUICK_DOODLE_ONLINE_HTR_REPO` is
set, the script exports them from a local PellelNitram/OnlineHTR checkout.
