# After Effect Tunnel

A reusable local bridge between an agent and Adobe After Effects. It inspects an open project and creates/edits native compositions, footage, text, shapes, properties, keyframes, expressions and effects. It also saves projects, exports preview frames, and queues or executes renders.

**This is the control layer.** The agent still plans the motion, chooses assets, inspects results and revises them. It cannot guarantee any requested video, invent missing footage, install missing effects, or replace visual judgment.

## Quick start — no installation needed

Requirements: Windows, Python 3.10+, installed After Effects 2025+ (tested with 2025). Open the project in AE first.

```powershell
Set-Location -LiteralPath 'C:\path\to\project
python tunnel.py doctor
python tunnel.py run examples/inspect.json --mode script
```

AE displays a **Tunnel result** dialog containing JSON. The agent reads it via its computer-use tool, then closes it. Script mode uses Adobe's `AfterFX.exe -r` mechanism; it does not need AE script file-write/network permission. A CLI `dispatched` result means the script was launched, not that AE completed it. Modal dialogs in AE can block dispatch.

If command-line dispatch is blocked or unavailable, build a standalone script:

```powershell
python tunnel.py build examples/inspect.json --output work/inspect-project.jsx
```

In AE use **File > Scripts > Run Script File** and select that JSX. It includes the whole runtime. Every build needs a fresh output filename.

## Optional panel — automatic JSON replies

```powershell
.\install-panel.ps1
```

Restart AE when convenient, then open **Window > Extensions > After Effect Tunnel** (some installations call this **Extensions (Legacy)**). Keep one instance open. Then:

```powershell
python tunnel.py status
python tunnel.py run examples/inspect.json --mode panel
python tunnel.py run examples/demo.json --mode panel
```

The panel receives local JSON jobs and returns JSON directly to the CLI. No model server, web server, API key, internet connection, or Python package installation is needed. The installer copies source into `%APPDATA%\Adobe\CEP\extensions\local.aftereffect.tunnel`; it does not change signing, debug, registry or scripting preferences. Unsigned panels may be blocked on machines without an existing development configuration. Use script mode in that case. AE-native preview file writes remain subject to AE's current permissions.

State lives in `%LOCALAPPDATA%\AfterEffectTunnel`:

- `inbox`: jobs waiting for the panel.
- `processing`: claimed jobs; a crash or reload leaves these here instead of replaying them.
- `outbox`: completed JSON results, readable with `python tunnel.py result JOB_ID`.
- `scripts`: standalone scripts dispatched by the CLI.
- `heartbeat.json`: panel activity, refreshed every half second.

These files can contain project names, paths, text and expressions. Everything stays local. Close the panel before manually archiving old job files. Use a new job ID for an intentional retry after inspecting the project.

## Typical agent workflow

1. Read AGENTS.md and COMMANDS.md. Inspect project and target composition.
2. Duplicate the composition. Save a new `.aep` path; the destination folder must already exist.
3. Import assets or create native layers. Apply animation using real IDs/property paths.
4. Inspect property values and clip in/out points after edits.
5. Discover installed render templates, render to a fresh MP4 path, and inspect decoded frames and motion.
6. Revise and return the editable project and video. A screenshot or successful command alone is not proof of a finished motion graphic.

`examples/demo.json` adds a small editable animation to the CURRENT project. It does not save or render automatically. Repeating it creates another composition. Use it only when that addition is intended.

For dependable rendering of a saved project, use Adobe's separate renderer:

```powershell
python tunnel.py render --project 'C:\absolute\project.aep' --comp 'Composition name' --output 'C:\absolute\new-video.mp4' --template 'H.264 - Match Render Settings - 15 Mbps'
```

This waits for the renderer and checks its exit code and output file. The composition uses the saved state, so save edits first. Existing output files are refused. For long renders, agents should launch the CLI with their process tool and poll the returned process session. Verify decoding and visual quality afterward.

For any future agent, say:

> Use the After Effect Tunnel in `C:\path\to\project`. Read AGENTS.md, inspect my open After Effects project, and use its commands to make [describe the video].

## Validation


Run python -m unittest discover -s tests -p "test_*.py" and node tests/runtime.test.cjs for offline checks. See RELEASE_REVIEW.md for this export.
