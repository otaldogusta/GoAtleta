import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { resolvePageBreadcrumbs } from "../../navigation/page-header-context";
import { useTrainerRouteScope } from "../../navigation/use-trainer-route-scope";
import { navigateToPrimaryRoute } from "../../navigation/primary-route-navigation";
import { PageBreadcrumbHeader } from "./PageBreadcrumbHeader";

type BackTitleHeaderProps = { title: string; onBack: () => void; context?: string; accessory?: ReactNode; style?: StyleProp<ViewStyle>; onBreadcrumbNavigate?: (navigate: () => void) => void };

export function BackTitleHeader({ title, onBack, context, accessory, style, onBreadcrumbNavigate }: BackTitleHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const routes = useTrainerRouteScope();
  const breadcrumbs = resolvePageBreadcrumbs(pathname, title, routes, context).map(item => ({ label: item.label, onPress: () => {
    const navigate = () => navigateToPrimaryRoute({ router, href: item.href as Href });
    if (onBreadcrumbNavigate) onBreadcrumbNavigate(navigate); else navigate();
  } }));
  return <PageBreadcrumbHeader title={title} breadcrumbs={breadcrumbs} onBack={onBack} accessory={accessory} style={[{ marginBottom: 4 }, style]} />;
}
