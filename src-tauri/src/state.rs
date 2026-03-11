use std::sync::{Mutex, RwLock};

use log::warn;
use tauri::{image::Image, tray::TrayIcon};

use crate::{
	components::tray::TrayMenuItems,
	helpers::{settings_types::SettingsSnapshot, shortcuts_runtime::CompiledShortcuts},
};

fn with_lock<T, R>(mutex: &Mutex<T>, name: &'static str, f: impl FnOnce(&mut T) -> R) -> R {
	match mutex.lock() {
		Ok(mut guard) => f(&mut guard),
		Err(poisoned) => {
			warn!("Mutex '{}' was poisoned, recovering.", name);
			let mut guard = poisoned.into_inner();
			f(&mut guard)
		}
	}
}

fn with_read<T, R>(lock: &RwLock<T>, name: &'static str, f: impl FnOnce(&T) -> R) -> R {
	match lock.read() {
		Ok(guard) => f(&guard),
		Err(poisoned) => {
			warn!("RwLock '{}' was poisoned (read), recovering.", name);
			f(&poisoned.into_inner())
		}
	}
}

fn with_write<T, R>(lock: &RwLock<T>, name: &'static str, f: impl FnOnce(&mut T) -> R) -> R {
	match lock.write() {
		Ok(mut guard) => f(&mut guard),
		Err(poisoned) => {
			warn!("RwLock '{}' was poisoned (write), recovering.", name);
			let mut guard = poisoned.into_inner();
			f(&mut guard)
		}
	}
}

pub struct WindowState {
	is_visible: Mutex<bool>,
	is_settings_visible: Mutex<bool>,
	tray_icon: Mutex<Option<TrayIcon>>,
	tray_menu_items: Mutex<Option<TrayMenuItems>>,
	restore_main_on_settings_close: Mutex<bool>,
	tray_active_icon: Mutex<Option<Image<'static>>>,
	tray_inactive_icon: Mutex<Option<Image<'static>>>,
}

impl WindowState {
	pub fn new() -> Self {
		Self {
			is_visible: Mutex::new(false),
			is_settings_visible: Mutex::new(false),
			tray_icon: Mutex::new(None),
			tray_menu_items: Mutex::new(None),
			restore_main_on_settings_close: Mutex::new(false),
			tray_active_icon: Mutex::new(None),
			tray_inactive_icon: Mutex::new(None),
		}
	}

	pub fn is_main_visible(&self) -> bool {
		with_lock(&self.is_visible, "is_visible", |visible| *visible)
	}

	pub fn set_main_visible(&self, visible: bool) {
		with_lock(&self.is_visible, "is_visible", |current| *current = visible);
	}

	pub fn is_settings_visible(&self) -> bool {
		with_lock(&self.is_settings_visible, "is_settings_visible", |visible| {
			*visible
		})
	}

	pub fn set_settings_visible(&self, visible: bool) {
		with_lock(&self.is_settings_visible, "is_settings_visible", |current| {
			*current = visible
		});
	}

	pub fn set_restore_main_on_settings_close(&self, restore: bool) {
		with_lock(
			&self.restore_main_on_settings_close,
			"restore_main_on_settings_close",
			|current| *current = restore,
		);
	}

	pub fn take_restore_main_on_settings_close(&self) -> bool {
		with_lock(
			&self.restore_main_on_settings_close,
			"restore_main_on_settings_close",
			|current| {
				let restore = *current;
				*current = false;
				restore
			},
		)
	}

	pub fn set_tray_icon(&self, tray_icon: TrayIcon) {
		with_lock(&self.tray_icon, "tray_icon", |current| {
			*current = Some(tray_icon);
		});
	}

	pub fn with_tray_icon<R>(&self, f: impl FnOnce(Option<&TrayIcon>) -> R) -> R {
		with_lock(&self.tray_icon, "tray_icon", |current| f(current.as_ref()))
	}

	pub fn set_tray_menu_items(&self, tray_menu_items: TrayMenuItems) {
		with_lock(&self.tray_menu_items, "tray_menu_items", |current| {
			*current = Some(tray_menu_items);
		});
	}

	pub fn with_tray_menu_items<R>(&self, f: impl FnOnce(Option<&TrayMenuItems>) -> R) -> R {
		with_lock(&self.tray_menu_items, "tray_menu_items", |current| {
			f(current.as_ref())
		})
	}

	pub fn set_cached_tray_icons(
		&self,
		active_icon: Option<Image<'static>>,
		inactive_icon: Option<Image<'static>>,
	) {
		with_lock(&self.tray_active_icon, "tray_active_icon", |current| {
			*current = active_icon;
		});
		with_lock(&self.tray_inactive_icon, "tray_inactive_icon", |current| {
			*current = inactive_icon;
		});
	}

	pub fn cached_tray_icon(&self, active: bool) -> Option<Image<'static>> {
		if active {
			with_lock(&self.tray_active_icon, "tray_active_icon", |current| {
				current.clone()
			})
		} else {
			with_lock(&self.tray_inactive_icon, "tray_inactive_icon", |current| {
				current.clone()
			})
		}
	}

	pub fn update_cached_tray_icon(&self, active: bool, icon: Image<'static>) {
		if active {
			with_lock(&self.tray_active_icon, "tray_active_icon", |current| {
				*current = Some(icon);
			});
		} else {
			with_lock(&self.tray_inactive_icon, "tray_inactive_icon", |current| {
				*current = Some(icon);
			});
		}
	}
}

pub struct AppSettingsState {
	snapshot: RwLock<SettingsSnapshot>,
	compiled_shortcuts: Mutex<CompiledShortcuts>,
}

impl AppSettingsState {
	pub fn new(snapshot: SettingsSnapshot, compiled_shortcuts: CompiledShortcuts) -> Self {
		Self {
			snapshot: RwLock::new(snapshot),
			compiled_shortcuts: Mutex::new(compiled_shortcuts),
		}
	}

	pub fn snapshot(&self) -> SettingsSnapshot {
		with_read(&self.snapshot, "settings_snapshot", |s| s.clone())
	}

	pub fn set_snapshot(&self, snapshot: SettingsSnapshot) {
		with_write(&self.snapshot, "settings_snapshot", |current| {
			*current = snapshot
		});
	}

	pub fn set_compiled_shortcuts(&self, compiled_shortcuts: CompiledShortcuts) {
		with_lock(&self.compiled_shortcuts, "compiled_shortcuts", |current| {
			*current = compiled_shortcuts
		});
	}
}
