import { confirmPlanWithoutPeriodization } from "../confirm-plan-without-periodization";
import type { ConfirmDialogOptions } from "../../../../ui/confirm-dialog";

describe("confirmation before generating without periodization", () => {
  it("continues without a prompt when the lesson has periodization", async () => {
    const confirm = jest.fn();
    expect(await confirmPlanWithoutPeriodization({ hasPeriodization: true, confirm, onConfigure: jest.fn() })).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("waits for explicit confirmation before allowing generation", async () => {
    let resolveChoice!: (value: boolean) => void;
    const confirm = jest.fn(() => new Promise<boolean>((resolve) => { resolveChoice = resolve; }));
    const generate = jest.fn();
    const result = confirmPlanWithoutPeriodization({ hasPeriodization: false, confirm, onConfigure: jest.fn() })
      .then((allowed) => { if (allowed) generate(); });
    await Promise.resolve();
    expect(generate).not.toHaveBeenCalled();
    resolveChoice(true);
    await result;
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does not generate or navigate when the prompt is dismissed", async () => {
    const onConfigure = jest.fn();
    const allowed = await confirmPlanWithoutPeriodization({ hasPeriodization: false, confirm: jest.fn().mockResolvedValue(false), onConfigure });
    expect(allowed).toBe(false);
    expect(onConfigure).not.toHaveBeenCalled();
  });

  it("opens configuration instead of allowing generation", async () => {
    const onConfigure = jest.fn();
    const confirm = jest.fn(async (options: ConfirmDialogOptions) => {
      expect(options.cancelLabel).toBe("Configurar periodização");
      options.onCancel?.();
      return false;
    });
    expect(await confirmPlanWithoutPeriodization({ hasPeriodization: false, confirm, onConfigure })).toBe(false);
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });
});
