"""Generates the README artwork (dark + light) into docs/assets.

Usage: python3 scripts/readme_assets.py docs/assets
Colors mirror the tokens in src/app/globals.css.
"""
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
SANS = "Geist, 'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

THEMES = {
    "dark": dict(bg="#0b0d10", bg2="#101317", card="#14171c", card2="#1a1e24", line="#262a31", fg="#f4f5f7",
                 muted="#9aa0a9", dim="#5c626b", accent="#c6f24e", accentInk="#1d2a06", blue="#5aa9ff",
                 orange="#ffae57", glow="0.20", grid="0.05", photo1="#1f2a22", photo2="#2b3a2a"),
    "light": dict(bg="#fafbfc", bg2="#f1f3f5", card="#ffffff", card2="#f4f6f8", line="#e2e5e9", fg="#15181d",
                  muted="#5b616b", dim="#9aa0a8", accent="#4b8a1c", accentInk="#ffffff", blue="#2f6fd6",
                  orange="#d9771a", glow="0.12", grid="0.06", photo1="#dfe8d6", photo2="#c9d9bd"),
}


def banner(t):
    w, h = 1280, 560
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="t d">
<title id="t">Supabox</title>
<desc id="d">Label images on a phone, export YOLOv8 datasets and train in one click.</desc>
<defs>
  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
    <path d="M32 0H0V32" fill="none" stroke="{t['fg']}" stroke-opacity="{t['grid']}" stroke-width="1"/>
  </pattern>
  <radialGradient id="glow" cx="0.78" cy="0.45" r="0.55">
    <stop offset="0" stop-color="{t['accent']}" stop-opacity="{t['glow']}"/>
    <stop offset="1" stop-color="{t['accent']}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{t['bg']}" stop-opacity="1"/>
    <stop offset="0.45" stop-color="{t['bg']}" stop-opacity="0.6"/>
    <stop offset="1" stop-color="{t['bg']}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="photo" x1="0" y1="0" x2="0.4" y2="1">
    <stop offset="0" stop-color="{t['photo2']}"/>
    <stop offset="1" stop-color="{t['photo1']}"/>
  </linearGradient>
  <clipPath id="screen"><rect x="880" y="78" width="252" height="420" rx="26"/></clipPath>
  <filter id="shadow" x="-60%" y="-60%" width="220%" height="240%">
    <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity="0.35"/>
  </filter>
</defs>
<rect width="{w}" height="{h}" rx="24" fill="{t['bg']}"/>
<rect width="{w}" height="{h}" rx="24" fill="url(#grid)"/>
<rect width="{w}" height="{h}" rx="24" fill="url(#glow)"/>
<rect width="760" height="{h}" fill="url(#fade)"/>
<rect x="0.5" y="0.5" width="{w-1}" height="{h-1}" rx="23.5" fill="none" stroke="{t['line']}"/>

<!-- logo -->
<g transform="translate(80 84)">
  <rect width="44" height="44" rx="11" fill="{t['accent']}"/>
  <g fill="none" stroke="{t['accentInk']}" stroke-width="2.6" stroke-linecap="round">
    <path d="M12 18v-4a2 2 0 0 1 2-2h4M26 12h4a2 2 0 0 1 2 2v4M32 26v4a2 2 0 0 1-2 2h-4M18 32h-4a2 2 0 0 1-2-2v-4"/>
  </g>
  <circle cx="22" cy="22" r="3.2" fill="{t['accentInk']}"/>
  <text x="60" y="31" font-family="{SANS}" font-size="26" font-weight="700" fill="{t['fg']}" letter-spacing="-0.5">Supabox</text>
  <rect x="180" y="9" width="104" height="26" rx="13" fill="none" stroke="{t['line']}"/>
  <text x="232" y="27" text-anchor="middle" font-family="{MONO}" font-size="12" fill="{t['muted']}">open source</text>
</g>

<!-- headline -->
<text font-family="{SANS}" font-weight="700" fill="{t['fg']}" font-size="56" letter-spacing="-2">
  <tspan x="78" y="236">Label on any device.</tspan>
  <tspan x="78" y="302">Train <tspan fill="{t['accent']}">YOLO</tspan> in one click.</tspan>
</text>
<text font-family="{SANS}" font-size="24" fill="{t['muted']}">
  <tspan x="80" y="372">A self-hosted labeling studio for phone,</tspan>
  <tspan x="80" y="406">tablet and laptop. Your servers, your data.</tspan>
</text>

<!-- chips -->
<g font-family="{MONO}" font-size="13" fill="{t['fg']}">
  <g transform="translate(80 448)">
    <rect width="152" height="34" rx="8" fill="{t['card']}" stroke="{t['line']}"/>
    <circle cx="18" cy="17" r="4" fill="{t['accent']}"/><text x="32" y="22">YOLOv8 export</text>
  </g>
  <g transform="translate(242 448)">
    <rect width="180" height="34" rx="8" fill="{t['card']}" stroke="{t['line']}"/>
    <circle cx="18" cy="17" r="4" fill="{t['blue']}"/><text x="32" y="22">one-click training</text>
  </g>
  <g transform="translate(434 448)">
    <rect width="160" height="34" rx="8" fill="{t['card']}" stroke="{t['line']}"/>
    <circle cx="18" cy="17" r="4" fill="{t['orange']}"/><text x="32" y="22">live camera test</text>
  </g>
</g>

<!-- phone -->
<g transform="translate(-60 0)">
<g filter="url(#shadow)">
  <rect x="868" y="66" width="276" height="444" rx="38" fill="{t['card2']}" stroke="{t['line']}" stroke-width="1.5"/>
</g>
<g clip-path="url(#screen)">
  <rect x="880" y="78" width="252" height="420" fill="url(#photo)"/>
  <!-- abstract scene -->
  <path d="M880 380 C 950 340, 1030 360, 1132 330 L1132 498 L880 498Z" fill="{t['photo1']}"/>
  <rect x="918" y="186" width="78" height="128" rx="12" fill="{t['bg2']}" opacity="0.9"/>
  <rect x="925" y="196" width="64" height="100" rx="6" fill="{t['card']}" opacity="0.8"/>
  <ellipse cx="1074" cy="356" rx="34" ry="22" fill="{t['photo2']}" stroke="{t['bg2']}" stroke-opacity="0.4"/>
  <path d="M1074 334 q 18 -40 4 -70" stroke="{t['photo2']}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- top bar -->
  <rect x="880" y="78" width="252" height="54" fill="{t['bg']}" opacity="0.82"/>
  <text x="900" y="110" font-family="{SANS}" font-size="13" font-weight="600" fill="{t['fg']}">image_2103</text>
  <text x="1112" y="110" text-anchor="end" font-family="{MONO}" font-size="11" fill="{t['muted']}">12 / 50</text>
  <!-- box 1 -->
  <rect x="910" y="176" width="94" height="146" rx="3" fill="{t['accent']}" fill-opacity="0.12" stroke="{t['accent']}" stroke-width="2.5"/>
  <rect x="910" y="156" width="64" height="20" rx="3" fill="{t['accent']}"/>
  <text x="918" y="170" font-family="{MONO}" font-size="11" font-weight="600" fill="{t['accentInk']}">phone</text>
  <g fill="{t['card']}" stroke="{t['accent']}" stroke-width="2">
    <circle cx="910" cy="176" r="5"/><circle cx="1004" cy="176" r="5"/><circle cx="910" cy="322" r="5"/><circle cx="1004" cy="322" r="5"/>
  </g>
  <!-- box 2 -->
  <rect x="1034" y="258" width="80" height="126" rx="3" fill="{t['orange']}" fill-opacity="0.12" stroke="{t['orange']}" stroke-width="2.5"/>
  <rect x="1034" y="238" width="46" height="20" rx="3" fill="{t['orange']}"/>
  <text x="1042" y="252" font-family="{MONO}" font-size="11" font-weight="600" fill="#1d1206">leaf</text>
  <!-- finger touch -->
  <circle cx="1004" cy="322" r="20" fill="{t['fg']}" fill-opacity="0.10" stroke="{t['fg']}" stroke-opacity="0.35"/>
  <!-- bottom bar -->
  <rect x="880" y="430" width="252" height="68" fill="{t['bg']}" opacity="0.88"/>
  <rect x="896" y="446" width="104" height="36" rx="10" fill="{t['card']}" stroke="{t['line']}"/>
  <text x="948" y="469" text-anchor="middle" font-family="{SANS}" font-size="12" fill="{t['fg']}">2 boxes</text>
  <rect x="1010" y="446" width="106" height="36" rx="10" fill="{t['accent']}"/>
  <text x="1063" y="469" text-anchor="middle" font-family="{SANS}" font-size="12" font-weight="600" fill="{t['accentInk']}">Done, next</text>
</g>
<rect x="972" y="86" width="68" height="16" rx="8" fill="{t['bg']}"/>
</g>
<!-- export card -->
<g transform="translate(1030 140)" filter="url(#shadow)">
  <rect width="214" height="250" rx="16" fill="{t['card']}" stroke="{t['line']}"/>
  <text x="20" y="34" font-family="{SANS}" font-size="14" font-weight="600" fill="{t['fg']}">Phone.zip</text>
  <text x="20" y="54" font-family="{MONO}" font-size="11" fill="{t['muted']}">ready for Ultralytics</text>
  <line x1="20" y1="70" x2="194" y2="70" stroke="{t['line']}"/>
  <g font-family="{MONO}" font-size="12" fill="{t['fg']}">
    <text x="20" y="96">data.yaml</text>
    <text x="20" y="120" fill="{t['muted']}">images/</text>
    <text x="36" y="140">train/ val/ test/</text>
    <text x="20" y="166" fill="{t['muted']}">labels/</text>
    <text x="36" y="186">image_2103.txt</text>
    <rect x="20" y="202" width="150" height="26" rx="6" fill="{t['card2']}"/>
    <text x="30" y="219" font-size="11" fill="{t['accent']}">0 0.42 0.53 0.25 0.29</text>
  </g>
</g>



<!-- detection card -->
<g transform="translate(712 334)" filter="url(#shadow)">
  <rect width="150" height="86" rx="14" fill="{t['card']}" stroke="{t['line']}"/>
  <text x="16" y="28" font-family="{MONO}" font-size="11" fill="{t['muted']}">live detection</text>
  <circle cx="22" cy="52" r="5" fill="{t['accent']}"/>
  <text x="34" y="56" font-family="{SANS}" font-size="13" fill="{t['fg']}">phone</text>
  <text x="134" y="56" text-anchor="end" font-family="{MONO}" font-size="13" font-weight="600" fill="{t['fg']}">92%</text>
  <rect x="16" y="66" width="118" height="5" rx="2.5" fill="{t['card2']}"/>
  <rect x="16" y="66" width="108" height="5" rx="2.5" fill="{t['accent']}"/>
</g>
</svg>
"""


def flow(t):
    w, h = 1280, 300
    steps = [
        ("01", "Upload", "Admin uploads photos.", "HEIC becomes JPEG,", "sorted into sections.", t["blue"]),
        ("02", "Label", "Researchers draw boxes", "on phone or laptop.", "Every box autosaves.", t["accent"]),
        ("03", "Export or train", "Download a YOLOv8 zip", "or train on your GPU", "in one click.", t["orange"]),
        ("04", "Test", "Run the model in your", "browser on a photo", "or a live camera.", t["fg"]),
    ]
    cw, gap, x0, y0 = 272, 24, 40, 48
    parts = [f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="t">
<title id="t">Workflow: upload, label, export or train, test</title>
<defs>
  <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
    <path d="M32 0H0V32" fill="none" stroke="{t['fg']}" stroke-opacity="{t['grid']}"/>
  </pattern>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
    <path d="M0 0L10 5L0 10z" fill="{t['dim']}"/>
  </marker>
</defs>
<rect width="{w}" height="{h}" rx="24" fill="{t['bg']}"/>
<rect width="{w}" height="{h}" rx="24" fill="url(#grid)"/>
<rect x="0.5" y="0.5" width="{w-1}" height="{h-1}" rx="23.5" fill="none" stroke="{t['line']}"/>
"""]
    for i, (num, title, a, b, c, col) in enumerate(steps):
        x = x0 + i * (cw + gap)
        parts.append(f"""<g transform="translate({x} {y0})">
  <rect width="{cw}" height="204" rx="18" fill="{t['card']}" stroke="{t['line']}"/>
  <rect x="24" y="24" width="4" height="48" rx="2" fill="{col}"/>
  <text x="40" y="40" font-family="{MONO}" font-size="14" fill="{t['muted']}">STEP {num}</text>
  <text x="40" y="70" font-family="{SANS}" font-size="27" font-weight="700" fill="{t['fg']}" letter-spacing="-0.6">{title}</text>
  <text font-family="{SANS}" font-size="19" fill="{t['muted']}">
    <tspan x="24" y="118">{a}</tspan><tspan x="24" y="146">{b}</tspan><tspan x="24" y="174">{c}</tspan>
  </text>
</g>""")
        if i < 3:
            ax = x + cw + 2
            parts.append(f'<line x1="{ax}" y1="{y0+102}" x2="{ax+gap-4}" y2="{y0+102}" stroke="{t["dim"]}" stroke-width="2" marker-end="url(#arrow)"/>')
    parts.append("</svg>\n")
    return "\n".join(parts)


for name, t in THEMES.items():
    (OUT / f"banner-{name}.svg").write_text(banner(t))
    (OUT / f"workflow-{name}.svg").write_text(flow(t))
print("ok")
