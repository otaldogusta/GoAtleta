# Higgsfield provider

This directory now contains:

- a safe mock provider
- an MCP-first provider layer for agent/CLI integrations
- a REST provider adapter kept as experimental fallback

## Current providers

### Mock

`HiggsfieldMockProvider`

- no API calls
- no credentials
- returns deterministic `draft` assets
- good for tests and local architecture validation

### MCP

`HiggsfieldMcpProvider`

- reads `HIGGSFIELD_MCP_ENABLED`
- reads `HIGGSFIELD_MCP_SERVER_URL`
- defaults to the documented MCP endpoint `https://mcp.higgsfield.ai`
- assumes authentication happens in the agent/CLI, not inside GoAtleta
- currently uses a noop local bridge until a real MCP bridge is connected
- always returns `draft`, never `approved`

### Real REST (experimental)

`HiggsfieldRealProvider`

- reads `HIGGSFIELD_API_KEY` or `EXPO_PUBLIC_HIGGSFIELD_API_KEY`
- builds prompts from local prompt builders
- calls the isolated Higgsfield client adapter
- normalizes responses into local media assets
- always returns `draft`, never `approved`
- should be treated as experimental until a stable REST contract exists

## Factory

Use `createHiggsfieldProvider()` when you want a safe default:

- if MCP config exists, it returns the MCP provider
- if MCP is absent and REST config exists, it returns the experimental REST provider
- if config is missing, it falls back to the mock provider

If MCP is configured but no local bridge is connected yet:

- the provider stays explicit about that state
- the app can create a handoff job for the agent instead of pretending generation succeeded
- the handoff flow stays outside the app credential model

## Scope

- image generation
- short exercise videos
- coach avatar assets
- marketing assets

## Non-scope

- periodization decisions
- daily plan resolution
- technical or pedagogical plan generation

## Rules

- GoAtleta remains the source of truth for planning decisions.
- Higgsfield only creates media assets.
- Any generated media must stay `draft` until `/prof/exercises` or another explicit approval flow marks it as `approved`.
- Never commit API keys or secrets to the repository.
- GoAtleta does not store Higgsfield account sessions.
