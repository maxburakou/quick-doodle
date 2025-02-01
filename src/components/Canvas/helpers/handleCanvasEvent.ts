import { listen, Event } from "@tauri-apps/api/event";

export const handleCanvasEvent = <T>(
  eventName: string,
  action: (event: Event<T>) => void
) => {
  return listen<T>(eventName, (event) => {
    console.log(`Received event: ${eventName}`, event.payload);
    action(event);
  });
};
