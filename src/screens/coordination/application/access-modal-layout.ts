const ACCESS_MODAL_SPLIT_MIN_WIDTH = 1200;

export const resolveAccessModalLayout = (viewportWidth: number) =>
  viewportWidth >= ACCESS_MODAL_SPLIT_MIN_WIDTH ? "split" : "stacked";
