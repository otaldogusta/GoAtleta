import type { ReactNode } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { spacing, radius } from "../../theme/tokens";
import { AppRefreshControl } from "../../ui/AppRefreshControl";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useNativeSidebarController } from "../../ui/native-sidebar-controller";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

export function FamilyScreenShell({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
}) {
  const { colors } = useAppTheme();
  const layout = useResponsiveLayout("dashboard");
  const { openMobileSidebar } = useNativeSidebarController();
  const showNativeMenu = Platform.OS !== "web" && !layout.usesWorkspaceShell;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingBottom: layout.usesWorkspaceShell ? spacing.xxl : 112,
        }}
        refreshControl={
          onRefresh ? (
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void onRefresh();
              }}
              tintColor={colors.text}
              colors={[colors.primaryBg]}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        <ResponsivePage
          variant="dashboard"
          gap={layout.density.pageGap}
        >
          <View
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            {showNativeMenu ? (
              <Pressable
                accessibilityLabel="Abrir menu principal"
                onPress={openMobileSidebar}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <GoAtletaIcon name="align" size={21} color={colors.text} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text
                numberOfLines={2}
                style={{
                  color: colors.text,
                  fontSize: layout.density.pageTitleFontSize,
                  lineHeight: layout.density.pageTitleLineHeight,
                  fontWeight: "800",
                }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          {children}
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
