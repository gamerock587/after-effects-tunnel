# After Effect Tunnel — agent entry point

Read README.md and COMMANDS.md before use. This is a local control tool for the user's installed After Effects, not an AI model or a video generator service.

1. Run `python tunnel.py doctor`, then `python tunnel.py status`.
2. Run `python tunnel.py run examples/inspect.json`. Auto uses the active CEP panel, otherwise script mode opens a result dialog. `dispatched` is NOT success: inspect the dialog using computer-use tools. Close it before another command.
3. Inspect the target comp, then use returned item IDs and layer IDs. Layer indexes and names are not stable identifiers. Within one request, use `as` and `{"ref":"alias"}` for newly created objects. Aliases do not persist between requests.
4. Work in a duplicate composition and save a new project path before substantial edits. Never close/open projects, delete assets, or overwrite unrelated files to perform a routine edit.
5. Use native editable layers, match-name property paths, eased keys and motion blur. Inspect properties/effects before guessing plug-in paths. Reinspect timing after changing duration or startTime: AE can trim negative-start layers.
6. For mobile product demos, the user wants LARGE close-ups so app details are readable. Use a short whole-phone reveal, then roughly 180–220% scale on the existing 1300x1000 phone precomp. Reposition around the relevant interface section; return to full phone briefly at the end. This is a preference from the initial project, not a universal preset.
7. Prefer `python tunnel.py render` with a saved project for exports; its separate Adobe renderer was live-tested. Native `render execute:true` can be blocked/deferred by AE UI state and must return an error unless status is DONE and the file exists. Render and inspect beginning/middle/end frames AND transition frames. Use FFprobe/FFmpeg for duration, decoding, contact sheets and continuous preview. Successful commands do not establish visual quality.
8. `ok:false` can mean a partially changed project. Inspect `results`, `partial`, and `error.actionIndex`, then inspect AE before recovery. One batch is an Undo group, not a transaction. Render/save/import external side effects are not reversible by Undo.
9. A timeout is an unknown outcome. Query `result JOB_ID`, `status`, and AE before resubmitting. Never replay a job in `processing` automatically.
10. Do not change OS, CEP signing/debug, or AE scripting security settings. The installer only copies extension files. If the optional panel is blocked, script mode works with UI result dialogs. Preview file writes may require the user to configure AE themselves; report the limitation rather than bypassing it.

No network service or API key is needed. Any agent with local filesystem/process access can use this CLI. Agents without those permissions cannot control AE with this tool alone. Respect the user's current request and host tool policies.
