import ProfileScreen from "../profile";

// perf-check: ignore-render -- the shared profile owns rendering and data loading.
// perf-check: ignore-measure -- route-only entry for the existing settings form.
export default function ProfileSettingsPage() {
  return <ProfileScreen settingsPage />;
}
