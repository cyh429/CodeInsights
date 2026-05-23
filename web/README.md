# CodeInsights Web

## Overview

This directory contains the static bilingual product homepage for `CodeInsights`.
It is intentionally framework-free for now so the project can ship a polished landing page
before a full frontend application is implemented.

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
- `styles.css`: visual system, layout, and responsive styling
- `app.js`: language toggle and reveal interactions
- `assets/diagrams/`: architecture and workflow SVG diagrams
- `assets/previews/`: concept preview SVGs for the hero and demo sections

## Scope

This version includes:

- Static homepage layout
- Bilingual toggle
- SVG architecture and preview assets
- Responsive presentation

This version does not include:

- Live chat or backend integration
- Real demo video
- A full Vue application shell
