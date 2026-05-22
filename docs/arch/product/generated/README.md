# CodeInsights Homepage Generated Diagrams

These SVG/PNG assets are generated from the CodeInsights homepage product materials.

Open the local gallery:

```text
./index.html
```

## Diagrams

The root `codeinsights-*.svg/png` files are the default flat-icon baseline. Each style folder under `styles/` contains the same four diagrams rendered with a different `fireworks-tech-graph` visual style.

| Diagram | Purpose |
|---|---|
| `codeinsights-product-architecture-overview.svg` / `.png` | Homepage product architecture overview: runtime access layer, Pipeline mode, and platform layer. |
| `codeinsights-runtime-access-boundary.svg` / `.png` | Explains why CodeInsights connects mature coding agent runtimes instead of rewriting a generic Agent kernel. |
| `codeinsights-pipeline-contribution-loop.svg` / `.png` | Shows the human-gated contribution flow: Explorer, Planner, Developer, Reviewer, Tester, and post-validation materials. |
| `codeinsights-trust-control-layer.svg` / `.png` | Shows the trust and control layer: permissions, gates, records, artifacts, checkpoints, and local workspace. |

## Style Sets

| Folder | Style |
|---|---|
| `styles/style-1-flat-icon/` | Flat Icon |
| `styles/style-2-dark-terminal/` | Dark Terminal |
| `styles/style-3-blueprint/` | Blueprint |
| `styles/style-4-notion-clean/` | Notion Clean |
| `styles/style-5-glassmorphism/` | Glassmorphism |
| `styles/style-6-claude-official/` | Claude Official |
| `styles/style-7-openai/` | OpenAI Official |

## Regenerate

```bash
node ./generate-codeinsights-diagrams.mjs
for f in ./codeinsights-*.svg; do sips -s format png "$f" --out "${f%.svg}.png"; done
find ./styles -type f -name '*.svg' -print0 |
  while IFS= read -r -d '' f; do sips -s format png "$f" --out "${f%.svg}.png"; done
```

## Validation

```bash
python3 -c "import xml.etree.ElementTree as ET; ET.parse('codeinsights-product-architecture-overview.svg')"
bash /Users/zq/.codex/skills/fireworks-tech-graph/scripts/validate-svg.sh codeinsights-product-architecture-overview.svg
```

For full validation:

```bash
python3 - <<'PY'
import pathlib, xml.etree.ElementTree as ET
base = pathlib.Path('.')
files = sorted(base.glob('codeinsights-*.svg')) + sorted((base / 'styles').glob('style-*/*.svg'))
for file in files:
    ET.parse(file)
print(f'xml-ok {len(files)}')
PY

find ./styles -type f -name '*.svg' -print0 |
  while IFS= read -r -d '' f; do
    bash /Users/zq/.codex/skills/fireworks-tech-graph/scripts/validate-svg.sh "$f"
  done
```
