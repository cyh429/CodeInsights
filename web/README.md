# CodeInsights Web

## Overview

This directory contains the static bilingual product homepage for `CodeInsights`.
It is intentionally framework-free because GitHub Pages deploys the `web/` folder
directly without a build step.

The current homepage follows the main README: CodeInsights is presented as a
local-first AI Agent desktop workbench for auditable Pipeline work, Agent
runtime sessions, MCP / Skills, and portable local records.

## Local Preview

Run the homepage locally from the repository root:

```bash
python -m http.server 8000 -d web
```

Then open [http://localhost:8000/](http://localhost:8000/).

## Public URL

- [https://zcxggmu.github.io/CodeInsights/](https://zcxggmu.github.io/CodeInsights/)

## Files

- `index.html`: homepage structure and bilingual copy
- `styles.css`: visual system, responsive layout, focus states, and reveal styling
- `app.js`: language toggle and reveal interactions
- `assets/brand/`: deployable logo asset
- `assets/screenshots/`: resized real Electron screenshots used by the homepage
- `assets/video/`: intro video, real-run video, and video poster/contact sheets
- `assets/diagrams-current/`: current architecture diagrams copied from root `assets/imgs/`
- `tests/`: structure tests for the static homepage

## Scope

This version includes:

- Static homepage layout
- Bilingual toggle
- Real product screenshots and video
- Current Pipeline, Agent Runtime, IPC, and local-storage diagrams
- Responsive presentation without a JavaScript framework

This version does not include:

- Live Electron APIs
- A backend service
- A separate web application shell
