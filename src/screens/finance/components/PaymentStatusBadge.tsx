import { Text, View } from "react-native";

import {
  invoiceStatusLabel,
  type InvoiceStatus,
} from "../../../finance/application/finance-format";
import { radius } from "../../../theme/tokens";
import { useAppTheme } from "../../../ui/app-theme";

export function PaymentStatusBadge({
  status,
  label,
}: {
  status: InvoiceStatus;
  label?: string;
}) {
  const { colors } = useAppTheme();
  const palette =
    status === "paid"
      ? { backgroundColor: colors.successBg, color: colors.successText, borderColor: colors.successBorder }
      : status === "overdue"
        ? { backgroundColor: colors.dangerBg, color: colors.dangerText, borderColor: colors.dangerBorder }
      : status === "canceled" || status === "refunded"
          ? { backgroundColor: colors.secondaryBg, color: colors.muted, borderColor: colors.border }
          : status === "open" || status === "awaiting_payment" || status === "partially_paid"
            ? { backgroundColor: colors.warningBg, color: colors.warningText, borderColor: colors.warningBorder }
            : { backgroundColor: colors.infoBg, color: colors.infoText, borderColor: colors.border };

  return (
    <View
      style={{
        alignSelf: "flex-start",
        minHeight: 26,
        borderRadius: radius.full,
        borderWidth: 1,
        paddingHorizontal: 9,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <Text style={{ color: palette.color, fontSize: 11, fontWeight: "800" }}>
        {label ?? invoiceStatusLabel[status]}
      </Text>
    </View>
  );
}
