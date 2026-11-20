<div align="center">

# After Effects Tunnel

### Control native, editable After Effects projects from a local CLI

![Source release](https://img.shields.io/badge/release-source-2563eb?style=flat-square)
![Local first](https://img.shields.io/badge/design-local--first-0f766e?style=flat-square)

**Coded by [zaid.dev](https://github.com/gamerock587)** · **invnty**

Python · ExtendScript · CEP

</div>

---

## What it does

- Inspect compositions and layers
- Submit structured native editing commands
- Render saved projects using Adobe tools

## Quick start

**Requirements:** Licensed Adobe After Effects, Python 3 and Node.js for runtime tests.

```powershell
python tunnel.py doctor
python tunnel.py status
python -m unittest discover -s tests -p "test_*.py"
node tests/runtime.test.cjs
```

## Before you run

Read COMMANDS.md and AGENTS.md before editing. The optional CEP panel may require your existing development setup; the installer does not weaken application security settings. Timeouts are unknown outcomes: inspect results before retrying. Demo jobs modify the current project. Commercial music, client projects and machine-specific examples are excluded.

## Documentation

See [USAGE.md](USAGE.md) for the original detailed operating guide.

## Privacy and configuration

This source export excludes local credentials, databases, sessions, logs, recordings,
personal spreadsheets and compiled distributions. Supply your own configuration.
The ignore rules help prevent accidental commits; they do not replace reviewing files.

## Contributing

Describe the problem, include reproducible steps with synthetic data, and keep changes focused.
Never include tokens, private recordings, customer data or personal contact lists in an issue.
Validation and remaining limitations are recorded in [RELEASE_REVIEW.md](RELEASE_REVIEW.md).

## License and attribution

Original application code is licensed under [MIT](LICENSE). Third-party components retain
their own licenses and authorship; see THIRD-PARTY-NOTICES.md and any bundled license files.
