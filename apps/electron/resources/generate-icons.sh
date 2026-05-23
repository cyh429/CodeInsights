#!/bin/bash

# CodeInsights 图标生成脚本
# 默认从已跟踪的 resources/icon.png 生成派生图标。
# 可通过 CODEINSIGHTS_ICON_SOURCE 指向新的 1024+ PNG 源图来刷新 icon.png。
# 依赖：python3 + Pillow；用外部源图刷新主图标时需要 macOS iconutil 同步 .icns。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_ICON="${CODEINSIGHTS_ICON_SOURCE:-$SCRIPT_DIR/icon.png}"

cd "$SCRIPT_DIR"

echo "Generating CodeInsights icons from: $SOURCE_ICON"

if [ ! -f "$SOURCE_ICON" ]; then
  echo "Source icon not found: $SOURCE_ICON"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found"
  exit 1
fi

if [ -n "${CODEINSIGHTS_ICON_SOURCE:-}" ] && ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil not found; refusing to refresh icon.png from CODEINSIGHTS_ICON_SOURCE without updating icon.icns"
  exit 1
fi

python3 - "$SOURCE_ICON" "$REPO_ROOT" <<'PY'
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except Exception as exc:
    raise SystemExit(f"Pillow is required to generate icons: {exc}")

source = Path(sys.argv[1]).resolve()
repo_root = Path(sys.argv[2]).resolve()
root = Path.cwd()
resample = getattr(Image, "Resampling", Image).LANCZOS
source_image = Image.open(source).convert("RGBA")
resized_icon = source_image.resize((1024, 1024), resample)

def remove_edge_background(image: Image.Image) -> Image.Image:
    """清理画布边缘连通的浅色背景，保留中间图标主体。"""
    image = image.copy()
    width, height = image.size
    data = list(image.getdata())
    candidate = bytearray(width * height)
    visited = bytearray(width * height)
    queue = deque()

    for index, (r, g, b, a) in enumerate(data):
        if a <= 8:
            candidate[index] = 1
            continue
        brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b
        saturation = max(r, g, b) - min(r, g, b)
        distance_to_white = ((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2) ** 0.5
        if (brightness >= 150 and saturation <= 58) or distance_to_white < 92:
            candidate[index] = 1

    def enqueue(index: int) -> None:
        if candidate[index] and not visited[index]:
            visited[index] = 1
            queue.append(index)

    for x in range(width):
        enqueue(x)
        enqueue((height - 1) * width + x)
    for y in range(height):
        enqueue(y * width)
        enqueue(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        if x > 0:
            enqueue(index - 1)
        if x < width - 1:
            enqueue(index + 1)
        if index >= width:
            enqueue(index - width)
        if index < width * (height - 1):
            enqueue(index + width)

    image.putdata([
        (r, g, b, 0) if visited[index] else (r, g, b, a)
        for index, (r, g, b, a) in enumerate(data)
    ])

    return image

icon = remove_edge_background(resized_icon)
target_icon = (root / "icon.png").resolve()
icon.save(target_icon, format="PNG")
icon_png_bytes = target_icon.read_bytes()

icon.save(
    root / "icon.ico",
    format="ICO",
    sizes=[(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (16, 16)],
)

iconset = root / "icon.iconset"
iconset.mkdir(exist_ok=True)
for name, size in {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}.items():
    icon.resize((size, size), resample).save(iconset / name, format="PNG")

logo_dir = root / "codeinsights-logos"
for logo in logo_dir.glob("codeinsights-*.png"):
    logo.write_bytes(icon_png_bytes)

def draw_template(size: int, output: Path) -> None:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    stroke = max(2, round(size * 0.14))
    bbox = [round(size * 0.14), round(size * 0.2), round(size * 0.65), round(size * 0.8)]
    draw.arc(bbox, 45, 315, fill=(0, 0, 0, 255), width=stroke)
    x = round(size * 0.77)
    y1 = round(size * 0.34)
    y2 = round(size * 0.76)
    radius = max(1, stroke // 2)
    draw.line((x, y1, x, y2), fill=(0, 0, 0, 255), width=stroke)
    draw.ellipse((x - radius, y1 - radius, x + radius, y1 + radius), fill=(0, 0, 0, 255))
    draw.ellipse((x - radius, y2 - radius, x + radius, y2 + radius), fill=(0, 0, 0, 255))
    dot_radius = max(1, round(stroke * 0.58))
    dot_y = round(size * 0.22)
    draw.ellipse((x - dot_radius, dot_y - dot_radius, x + dot_radius, dot_y + dot_radius), fill=(0, 0, 0, 255))
    image.save(output, format="PNG")

draw_template(22, logo_dir / "iconTemplate.png")
draw_template(44, logo_dir / "iconTemplate@2x.png")
draw_template(66, logo_dir / "iconTemplate@3x.png")

renderer_model = repo_root / "apps/electron/src/renderer/assets/models/codeinsights.png"
renderer_model.parent.mkdir(parents=True, exist_ok=True)
renderer_model.write_bytes(icon_png_bytes)

renderer_logo_dir = repo_root / "apps/electron/src/renderer/assets/bots/codeinsights-logos"
if renderer_logo_dir.exists():
    for logo in logo_dir.glob("codeinsights-*.png"):
        target = renderer_logo_dir / logo.name
        target.write_bytes(icon_png_bytes)

web_logo = repo_root / "web/assets/brand/logo.webp"
if web_logo.parent.exists():
    icon.save(web_logo, format="WEBP", lossless=True, quality=100, method=4)

for video_logo in (
    repo_root / "assets/video/assets/codeinsights-logo-cutout.png",
    repo_root / "assets/video/assets/codeinsights-logo-cutout-final.png",
):
    if video_logo.parent.exists():
        video_logo.write_bytes(icon_png_bytes)
PY

if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns icon.iconset -o icon.icns
  rm -rf icon.iconset
  echo "Generated icon.icns"
else
  rm -rf icon.iconset
  echo "iconutil not found; skipped icon.icns"
fi

echo "Generated Electron, renderer, web, video, and tray CodeInsights icons."
