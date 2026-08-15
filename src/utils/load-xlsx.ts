type XlsxModule = typeof import("@e965/xlsx");

let xlsxPromise: Promise<XlsxModule> | null = null;

export function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxPromise) {
    xlsxPromise = Promise.all([
      import("@e965/xlsx"),
      import("@e965/xlsx/dist/cpexcel"),
    ])
      .then(([XLSX, cptable]) => {
        const xlsxWithCodepage = XLSX as XlsxModule & {
          set_cptable?: (value: unknown) => void;
        };
        if (typeof xlsxWithCodepage.set_cptable === "function") {
          xlsxWithCodepage.set_cptable(cptable);
        }
        return XLSX;
      })
      .catch((error) => {
        xlsxPromise = null;
        throw error;
      });
  }

  return xlsxPromise;
}
