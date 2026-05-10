"use strict";

const commands = {
  "plan:help": "Show available planner commands.",
  "plan:day --classId <id> --date <YYYY-MM-DD>": "Placeholder for daily planning execution.",
  "plan:week --classId <id> --week <YYYY-MM-DD>": "Placeholder for weekly planning execution.",
  "plan:check --file <path>": "Placeholder for validating serialized planning input.",
  "plan:export --file <path> --format pdf": "Placeholder for exporting planning artifacts.",
};

function printHelp() {
  console.log("GoAtleta Planner CLI");
  console.log("");
  console.log("Current commands:");
  Object.entries(commands).forEach(([command, description]) => {
    console.log(`  ${command}`);
    console.log(`    ${description}`);
  });
  console.log("");
  console.log("This placeholder does not read the database or mutate real planning data yet.");
}

function main() {
  const command = process.argv[2] || "plan:help";

  if (command === "plan:help") {
    printHelp();
    return;
  }

  console.error(`Command not implemented yet: ${command}`);
  console.error("Run `npm run goatleta:plan -- plan:help` to view planned commands.");
  process.exit(1);
}

main();
