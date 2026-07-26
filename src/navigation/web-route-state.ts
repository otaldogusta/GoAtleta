export function stripExpoRouterInternalParams(href: string): string {
  const url = new URL(href, "https://goatleta.local");

  if (url.searchParams.get("initial") !== "false") {
    return href;
  }

  url.searchParams.delete("initial");
  return `${url.pathname}${url.search}${url.hash}`;
}
