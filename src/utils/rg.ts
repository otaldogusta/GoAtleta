/** Presentation only: legacy RG formats differ by issuing state. */
export function formatRg(value: string): string {
  const raw = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  if (!/^\d+[\dX]$/.test(raw)) return raw;
  const body = raw.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${raw.slice(-1)}`;
}
