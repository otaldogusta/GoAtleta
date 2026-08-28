type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const normalizeInset = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

export const resolveClassPlanModalSafeAreaPadding = (
  compact: boolean,
  insets: SafeAreaInsets,
) => ({
  paddingTop: compact ? normalizeInset(insets.top) : 0,
  paddingRight: compact ? normalizeInset(insets.right) : 0,
  paddingBottom: compact ? normalizeInset(insets.bottom) : 0,
  paddingLeft: compact ? normalizeInset(insets.left) : 0,
});
