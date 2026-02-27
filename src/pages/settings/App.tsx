import { useEffect, useMemo, useState } from "react";
import { useSettingsStore } from "@/store";
import { listen } from "@tauri-apps/api/event";
import { SettingsSnapshot } from "@/types/settings";

const SettingsApp = () => {
  const { load, draft, dirty, save, cancel, revertDefaults, validate, applySnapshot } =
    useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().catch((err) => setError(String(err)));

    const unlisten = listen<SettingsSnapshot>("settings-updated", (event) => {
      applySnapshot(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [load, applySnapshot]);

  const draftJson = useMemo(() => {
    if (!draft) return "Loading...";
    return JSON.stringify(draft, null, 2);
  }, [draft]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      const issues = await validate();
      if (issues.length > 0) {
        setError(`${issues.length} validation issue(s).`);
        return;
      }
      await save();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 16, fontFamily: "JetBrains Mono, monospace" }}>
      <h2>Settings</h2>
      <p>Draft state wired. Final UI will be implemented separately.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={revertDefaults}>
          Revert to default
        </button>
        <button type="button" onClick={cancel} disabled={!dirty}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {error ? <p style={{ color: "#c1121f" }}>{error}</p> : null}

      <pre
        style={{
          maxHeight: "65vh",
          overflow: "auto",
          background: "#f5f5f5",
          padding: 12,
          borderRadius: 8,
        }}
      >
        {draftJson}
      </pre>
    </main>
  );
};

export default SettingsApp;
