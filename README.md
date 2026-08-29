<div align="center">

# 🎨 Quick Doodle

**A lightweight macOS annotation tool for sketches, explanations, and presentations.**

</div>

## 📽 Preview

<p align="center">
  <img src="demo/quick-doodle-demo-preview.gif" alt="Quick Doodle demo" width="700" />
</p>

Quick Doodle lets you draw directly over anything on your screen. Open a transparent canvas whenever you need it, add an annotation, then hide it without losing your work.

## ✨ Features

- **Nine tools:** Pen, Highlighter, Arrow, Line, Rectangle, Diamond, Ellipse, Text, and Select.
- **Smart Assist:** turn rough pen strokes into clean lines, arrows, rectangles, diamonds, and ellipses—or convert handwritten English into editable text using macOS-native recognition.
- **Flexible editing:** select one or multiple elements, then move, resize, rotate, copy, cut, paste, or delete them.
- **Snap hints:** align new and existing elements to nearby points, edges, and axes.
- **Custom styling:** choose colors and stroke widths, adjust font size, and add fills to supported shapes.
- **Canvas history:** undo, redo, clear, or reset the canvas; clearing is undoable, while resetting starts fresh.
- **Light, dark, and system themes**, plus a draggable toolbar that stays out of the way.
- **Tray-first workflow:** show or hide the canvas without losing progress, or create a new canvas at any time.
- **Dedicated Settings window:** customize shortcuts, startup behavior, tray actions, and the canvas activation frame.

> [!TIP]
> Smart Assist is available in the Pen tool. Enable it with the sparkle button in the toolbar, then pause briefly after drawing.

## 📦 Download

- 🖥️ [Download for Intel Macs (x64)](https://github.com/maxburakou/quick-doodle/releases/latest/download/Quick.Doodle_x64.dmg)
- 🍏 [Download for Apple Silicon Macs](https://github.com/maxburakou/quick-doodle/releases/latest/download/Quick.Doodle_aarch64.dmg)

## 🚀 How It Works

### Tray Icon Controls

- **Left-click** the tray icon to show or hide the drawing canvas. The icon turns green while the canvas is active.
- **Right-click** the tray icon to access canvas actions, theme controls, Settings, and Quit.
- By default, reopening the canvas restores your previous drawing. You can change the left-click behavior in Settings so it creates a fresh canvas instead.

### Settings

Open **Settings** from the tray menu to:

- record, clear, or restore shortcuts;
- launch Quick Doodle automatically when you sign in;
- choose whether tray left-click restores the previous canvas or opens a new one;
- show or hide the activation frame, including when the canvas already contains a drawing.

## 🎹 Keyboard Shortcuts

These are the default shortcuts. All global, history, clipboard, tool-selection, and toggle shortcuts can be changed or cleared in **Settings**.

### 🌍 Global Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘ ⇧ D` | **Create New Canvas** — open an empty canvas |
| `⌘ ⇧ S` | **Show / Hide Canvas** — toggle the previous canvas |

### 🖌 Canvas Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘ Z` | **Undo** |
| `⌘ ⇧ Z` | **Redo** |
| `⌘ ⇧ C` | **Clear Canvas** — can be undone |
| `⌘ R` | **Reset Canvas** — cannot be undone |
| `⌘ C` | **Copy Selection** — Select tool |
| `⌘ X` | **Cut Selection** — Select tool |
| `⌘ V` | **Paste** — Select tool |
| `⌘ T` | **Show / Hide Toolbar** |
| `⌘ A` | **Toggle Canvas Background** |
| `⌘ E` | **Toggle Snap Hints** |
| `⌘ ⇧ M` | **Cycle Theme** — light, dark, and system |

### 🧰 Tool Shortcuts

The number-row and numeric-keypad keys both work.

| Shortcut | Tool | Shortcut | Tool |
| --- | --- | --- | --- |
| `1` | Pen | `6` | Diamond |
| `2` | Highlighter | `7` | Ellipse |
| `3` | Arrow | `8` | Text |
| `4` | Line | `9` | Select |
| `5` | Rectangle |  |  |

### ⚡ Quick Controls

| Shortcut | Action |
| --- | --- |
| `[` / `]` | Previous / next stroke width, or font size when using Text |
| `⇧ [` / `⇧ ]` | Previous / next color |
| `Delete` / `Backspace` | Delete the current selection |
| `⌘ Q` | Quit Quick Doodle |
