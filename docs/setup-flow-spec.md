# Setup Flow Spec

Date: 2026-05-29

## Goal

The first-run experience should let a local user move from an empty Shimmy UI environment to a verified local Shimmy runtime without reading implementation docs.

The flow is implemented as an Overview checklist rather than a separate wizard. This keeps the app useful for both new users and returning operators.

## Entry Point

The setup flow starts on the Overview tab in `src/components/dashboard/overview-panel.tsx`.

The top card shows:

- Current next step.
- A primary CTA for that step.
- Five setup items with done/needs-action state.

## Steps

1. Install or choose Shimmy.
   - Done when `status.binary.executable` is true.
   - CTA: Runtime.
   - User can install the managed binary or configure an existing binary.

2. Configure model directories.
   - Done when at least one configured model directory is readable.
   - CTA: Config.
   - Config supports multi-line model directories.

3. Discover models.
   - Done when app model rows exist or Shimmy health reports model totals.
   - CTA: Models.
   - Models shows discovery result count, elapsed time, or failure reason.

4. Start service.
   - Done when status is `running-managed` or `running-external`.
   - CTA: Runtime.
   - Existing external Shimmy services are treated as connected, not owned.

5. Send test message.
   - Done when the service is running and at least one model is available.
   - CTA: Chat or smoke test.
   - Smoke test uses the localized smoke prompt and writes the result into Chat history.

## Error Handling

Each failed action should surface a Snackbar with a localized explanation and next-step advice. Common examples are missing binary, model directory without GGUF files, port conflict, network failure, checksum failure, runtime busy, and oversized or timed-out chat proxy requests.

## Verification

Current automated coverage:

- `src/app/page.test.tsx` verifies the task-oriented setup checklist.
- `tests/e2e/shimmy-ui.spec.ts` verifies the Chinese console, setup checklist visibility, fake Shimmy lifecycle, model discovery, Chat smoke behavior, diagnostics, and log controls.
- `src/lib/shimmy/model-dirs.test.ts` verifies model directory health scanning behavior.

Manual spot checks should use a 390 px mobile viewport and a desktop viewport to verify that setup CTAs remain reachable and do not overlap the bottom navigation.
