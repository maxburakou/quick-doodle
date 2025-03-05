import { invoke } from "@tauri-apps/api/core";

export async function toggleBackground() {
  try {
    await invoke("toggle_background");
  } catch (error) {
    console.error("Error during the background change:", error);
  }
}
