import { sessionPlanHtml } from "../templates/session-plan";

describe("session-plan language sanitization", () => {
  it("removes forbidden foreign terms from exported html", () => {
    const html = sessionPlanHtml({
      className: "Turma 08-10",
      dateLabel: "10/02/2026",
      title: "Toetsen e cmv niveau no tema",
      objective: "Execution quality e context reading",
      notes: "Best response com keer spelen",
      blocks: [
        {
          key: "main",
          label: "Parte principal",
          durationMinutes: 40,
          activities: [
            {
              name: "Toetsen level 1",
              description: "CMV niveau 2 com schoolvolleybal",
            },
          ],
        },
      ],
    });

    const lowered = html.toLowerCase();
    expect(lowered).not.toContain("toetsen");
    expect(lowered).not.toContain("cmv niveau");
    expect(lowered).not.toContain("execution quality");
    expect(lowered).not.toContain("context reading");
    expect(lowered).not.toContain("best response");
    expect(lowered).not.toContain("keer spelen");
    expect(lowered).not.toContain("schoolvolleybal");
  });
});
