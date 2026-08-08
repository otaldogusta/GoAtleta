import { Redirect } from "expo-router";
import { ActivityIndicator, Platform, View } from "react-native";
import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import { useEffectiveProfile } from "../src/hooks/use-effective-profile";
import { useOptionalOrganization } from "../src/providers/OrganizationProvider";
import { useAppTheme } from "../src/ui/app-theme";

// perf-check: ignore-render
// perf-check: ignore-measure
export default function Home() {
  const { colors } = useAppTheme();
  const { session, loading: authLoading } = useAuth();
  const { loading: roleLoading, role, devProfilePreview } = useRole();
  const organization = useOptionalOrganization();
  const profile = useEffectiveProfile();
  const isWeb = Platform.OS === "web";
  const browserPathname =
    isWeb && typeof window !== "undefined"
      ? window.location.pathname.length > 1
        ? window.location.pathname.replace(/\/+$/, "")
        : window.location.pathname
      : "/";
  const shouldWaitForOrganization =
    devProfilePreview === "auto" &&
    role === "trainer" &&
    Boolean(organization?.isLoading);

  // Aguarda o auth/role/preview carregar antes de redirecionar.
  if (authLoading || roleLoading || shouldWaitForOrganization) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primaryBg} />
      </View>
    );
  }
  if (isWeb && browserPathname !== "/" && browserPathname !== "/index") return null;

  if (!session) return <Redirect href="/welcome" />;
  if (role === "pending") return <Redirect href="/pending" />;

  if (profile === "student") return <Redirect href="/student/home" />;
  if (profile === "admin") return <Redirect href="/coord/dashboard" />;
  return <Redirect href="/prof/home" />;
}
