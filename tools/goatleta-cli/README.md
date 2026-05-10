# GoAtleta Planner CLI

This directory is reserved for the future standalone planner CLI.

Current entrypoint:

- `npm run goatleta:plan -- plan:help`

Current status:

- placeholder only
- no database access
- no planning mutations
- no export pipeline yet

Planned commands:

- `plan:day --classId <id> --date <YYYY-MM-DD>`
- `plan:week --classId <id> --week <YYYY-MM-DD>`
- `plan:check --file <path>`
- `plan:export --file <path> --format pdf`
