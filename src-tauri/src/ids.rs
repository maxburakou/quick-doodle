pub mod events {
	pub const RESET_CANVAS: &str = "reset-canvas";
	pub const CLEAR_CANVAS: &str = "clear-canvas";
	pub const UNDO_CANVAS: &str = "undo-canvas";
	pub const REDO_CANVAS: &str = "redo-canvas";
	pub const TOGGLE_BACKGROUND_CANVAS: &str = "toggle-background-canvas";
	pub const TOGGLE_TOOLBAR_CANVAS: &str = "toggle-toolbar-canvas";
	pub const TOGGLE_SNAP_CANVAS: &str = "toggle-snap-canvas";
}

pub mod menu_ids {
	pub const UNDO: &str = "undo";
	pub const REDO: &str = "redo";
	pub const CLEAR: &str = "clear";
	pub const RESET: &str = "reset";
	pub const QUIT: &str = "quit";
	pub const QUIT_CANVAS: &str = "quit_canvas";
	pub const HIDE_CANVAS: &str = "hide_canvas";
	pub const SETTINGS: &str = "settings";
	pub const BACKGROUND: &str = "background";
	pub const TOOLBAR: &str = "toolbar";
	pub const SNAP: &str = "snap";
}

pub mod window_labels {
	pub const MAIN: &str = "main";
	pub const SETTINGS: &str = "settings";
}
