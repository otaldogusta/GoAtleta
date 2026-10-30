import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { useAppTheme } from "../../ui/app-theme";

export function useCalendarEditorScrollbars(enabled: boolean) {
  const { colors } = useAppTheme();
  useLayoutEffect(() => {
    if (!enabled || Platform.OS !== "web" || typeof document === "undefined") return;
    const style = document.createElement("style");
    // Dropdowns change the global scrollbar width. Keep this editor's gutter and thumb stable.
    style.textContent = `
#calendar-event-editor-scroll { scrollbar-width: auto !important; scrollbar-color: auto !important; scrollbar-gutter: stable !important; }
#calendar-event-editor-scroll::-webkit-scrollbar { width: 4px !important; height: 4px !important; }
#calendar-event-editor-scroll::-webkit-scrollbar-track { background: transparent !important; }
#calendar-event-editor-scroll::-webkit-scrollbar-thumb { background-color: ${colors.border} !important; border: none !important; border-radius: 999px !important; }
#calendar-event-editor-scroll::-webkit-scrollbar-thumb:hover { background-color: ${colors.muted} !important; }
#calendar-event-editor-scroll::-webkit-scrollbar-button { display: none !important; width: 0 !important; height: 0 !important; }
@supports not selector(::-webkit-scrollbar) { #calendar-event-editor-scroll { scrollbar-width: thin !important; scrollbar-color: ${colors.border} transparent !important; } }
`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [enabled, colors.border, colors.muted]);
}
