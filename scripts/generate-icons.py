#!/usr/bin/env python3
"""Generate PWA PNG icons from favicon.svg (square + maskable)."""

import re
import sys
import cairosvg

FAVICON = "public/favicon.svg"
OUT_DIR = "public"

with open(FAVICON, "r") as f:
    original = f.read()

# Extract inner content (strip outer <svg> wrapper)
inner = re.sub(r"^<svg[^>]*>", "", original)
inner = re.sub(r"</svg>\s*$", "", inner)

# --- Normal icon: fills canvas, blue background, vertically centered ---
# Original viewBox is 48x46 → place on 48x48 square, translate y by 1 to center
normal_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48">
<rect width="48" height="48" fill="#5b8def"/>
<g transform="translate(0, 1)">
{inner}
</g>
</svg>"""

# --- Maskable icon: 80% safe zone, centered with padding ---
# Scale 0.8, translate to center on 48x48 canvas
maskable_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 48 48">
<rect width="48" height="48" fill="#5b8def"/>
<g transform="translate(4.8, 5.6) scale(0.8)">
{inner}
</g>
</svg>"""

sizes = [192, 512]
for size in sizes:
    # Normal
    cairosvg.svg2png(
        bytestring=normal_svg.encode("utf-8"),
        write_to=f"{OUT_DIR}/icon-{size}.png",
        output_width=size,
        output_height=size,
    )
    print(f"Generated {OUT_DIR}/icon-{size}.png")

# Maskable (only 512 is enough for manifest "maskable" purpose)
cairosvg.svg2png(
    bytestring=maskable_svg.encode("utf-8"),
    write_to=f"{OUT_DIR}/icon-maskable-512.png",
    output_width=512,
    output_height=512,
)
print(f"Generated {OUT_DIR}/icon-maskable-512.png")

# Apple touch icon (180x180)
cairosvg.svg2png(
    bytestring=normal_svg.encode("utf-8"),
    write_to=f"{OUT_DIR}/apple-touch-icon.png",
    output_width=180,
    output_height=180,
)
print(f"Generated {OUT_DIR}/apple-touch-icon.png")

print("\nAll icons generated successfully!")
