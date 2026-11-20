# Request and command reference

Requests are JSON files: `{"version":1,"label":"Optional Undo label","actions":[...]}`.
Every action has `op`. Creation/duplication/import actions can use `as:"name"`; later actions in that same request refer to the ID with `{"ref":"name"}`. Otherwise `comp`, `layer`, `source`, `parent`, and `before` are numeric IDs returned by inspection. IDs are project-specific; inspect after reopening.

Results have `ok`, `results`, `aliases`, `error`, `partial`. `error.actionIndex` is zero-based; property indices are one-based. Partial results are NOT rolled back. No automatic retries.

Up to 2,000 actions are accepted per request. Created layers (`text`, `shape`, `solid`, `addLayer`) may include `span:[inPoint,outPoint]` to set visibility without an extra command. Set source offsets separately with `layerSettings.startTime`.

## Read operations

| op | Fields | Returns |
|---|---|---|
| ping | none | AE version and current project |
| inspect | optional `comp` | Project items, or full composition/layer summary |
| properties | `comp`, `layer`, optional `property`, `depth` (default 3, max 8) | Match names, indices, values and up to 100 keyframes per property |
| effects | optional `search` | Installed effects and exact match names |
| renderTemplates | `comp` | Installed output-module/render-setting template names |

## Creation

| op | Fields |
|---|---|
| createComp | `name`, `width`, `height`, `duration`, `fps` (default 25) |
| duplicateComp | `comp`, `name` |
| import | absolute `path` |
| addLayer | `comp`, `source`, optional `name` |
| text | `comp`, `text`, optional `name`, `font` (PostScript name), `fontSize`, `color`, `position`, `centerAnchor`, `tracking`, `leading` |
| solid | `comp`, `name`, `color`, optional `atBottom` (default true) |
| shape | `comp`, optional `name`, `kind` (`rectangle`/`ellipse`), `size`, `roundness`, `position`, `fill`, `stroke`, `strokeWidth`; or `vertices`, `inTangents`, `outTangents`, `closed` for a path |

Colors are RGB arrays 0..1. `fill:null` omits fill. Shape vertices are local coordinates centered on the layer; tangents are relative to vertices. Text is centered horizontally on `position`, with normal baseline placement. AE font substitution can occur: visually check it.

## Editing

- `set`: `comp`, `layer`, `property`, `value`; optional `time` adds a keyframe instead of setting a constant.
- `animate`: `comp`, `layer`, `property`, `keys:[{"time":0,"value":...}]`; optional `replace:true` replaces existing keys on that property; `ease` defaults true, `influence` defaults 70 (0.1..100). Easing uses zero endpoint velocity; spatial tangents are straight. Use fewer meaningful keys for continuous movement, or `ease:false` for linear keys.
- `expression`: `comp`, `layer`, `property`, `expression`. An empty string clears it. Expression errors are reported but the invalid expression may remain until repaired/undone.
- `layerSettings`: `comp`, `layer`; optional `name`, `enabled`, `locked`, `threeD`, `motionBlur`, `startTime`, `inPoint`, `outPoint`, `parent` (ID or null), `atBottom`, `before`. Parenting preserves the current transform in AE; explicitly set local position/scale afterward when building a rig. Put `locked:false` on a locked layer before editing it.
- `compSettings`: `comp`; optional `duration`, `fps`, `motionBlur`, `shutterAngle`, `time`, `open` (defaults true). Changing duration/startTime can affect negative-start clip timing. Inspect afterward.
- `addEffect`: `comp`, `layer`, exact `matchName` from `effects`. Returns the effect tree. Use `set`/`animate` for its parameters. Reinspect property indices after adding effects/operators.
- `shapeOperator`: `comp`, `layer`, native `matchName`, optional parent `property` path (defaults to the first shape group's contents). Adds a shape operator such as `ADBE Vector Filter - Trim` or `ADBE Vector Filter - Repeater` and returns its property tree. Inspect/reacquire indices after adding it. This accepts native `ADBE Vector ...` operators, not scripts.

`text.centerAnchor:true` uses the actual text bounds to center its anchor, making rotation and scaling predictable. `tracking` uses AE's thousandths-of-em units; `leading` uses pixels and disables automatic leading.

Example property paths:

```json
["ADBE Transform Group", "ADBE Position"]
["ADBE Transform Group", "ADBE Scale"]
["ADBE Transform Group", "ADBE Rotate Z"]
["ADBE Transform Group", "ADBE Opacity"]
["ADBE Effect Parade", 1, 2]
```

For 2D layers, position/scale values have two numbers. For 3D layers, three. A scalar property needs one number. Separated position dimensions require their inspected follower property paths.

## Output

- `save`: absolute `path` to a new `.aep`; `overwrite:true` explicitly permits replacement. Parent directory must exist. Does not collect/copy source media.
- `preview`: `comp`, `time` (0 <= time < duration), absolute PNG `path`; optional `overwrite:true`. Uses AE's native `saveFrameToPng`, subject to script write permissions.
- `render`: `comp`, absolute `path`, `template` (exact installed output-module name); optional `settings` (render-setting template), `start`, `duration`, `execute` (default false), `overwrite` (default false). Default adds an unqueued render item. `execute:true` requests native rendering and only reports success for DONE status plus an existing output file. UI state can defer native rendering; use the separately tested `python tunnel.py render` path for saved projects. It refuses to run with other queued jobs. Match the extension to the chosen output template. An existing file is rejected unless explicitly allowed; AE can still present its own overwrite dialog.

Discover templates rather than assuming H.264 is available. On the validated AE 2025 machine, `H.264 - Match Render Settings - 15 Mbps` exists.

Example second request after inspecting IDs:

```json
{"version":1,"actions":[
 {"op":"inspect","comp":123},
 {"op":"animate","comp":123,"layer":456,
  "property":["ADBE Transform Group","ADBE Scale"],"replace":true,
  "keys":[{"time":0,"value":[100,100]},{"time":1.2,"value":[220,220]}]},
 {"op":"compSettings","comp":123,"time":2}
]}
```

123/456 are placeholders; replace them with IDs returned by the current project's inspection.
