import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auth email templates", () => {
  const codes = ["confirmation", "magic_link", "reauthentication"];
  const links = ["recovery", "email_change", "invite"];
  test.each([...codes, ...links])("%s preserves branding and its auth action", (name) => {
    const html = readFileSync(resolve("supabase/templates", `${name}.html`), "utf8");
    expect(html).toContain("max-width:440px");
    expect(html).toContain("#0E1729");
    expect(html).toContain("#3DDC84");
    expect(html).toContain("#FFFDF8");
    expect(html).not.toMatch(/<script|<img|\$\{code\}|10 minutos/);
    expect(html).not.toContain("e-mail alternativo");
    if (codes.includes(name)) {
      expect(html).toContain("{{ .Token }}");
      expect(html).not.toContain("{{ .ConfirmationURL }}");
    } else {
      expect(html).toContain('href="{{ .ConfirmationURL }}"');
      expect(html).not.toContain("{{ .Token }}");
    }
    const config = readFileSync(resolve("supabase/config.toml"), "utf8");
    expect(config).toContain(`[auth.email.template.${name}]`);
    expect(config).toContain(`./supabase/templates/${name}.html`);
  });
});
