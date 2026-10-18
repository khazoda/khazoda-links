import json
import shutil
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLATFORMS = {
    "modrinth": ("Modrinth", "modrinth.svg"),
    "curseforge": ("CurseForge", "curseforge.svg"),
    "github": ("GitHub", "github.svg"),
    "website": ("khazoda.com", "khazoda.png"),
}


def quicklink(site, url=None):
    label, icon = PLATFORMS[site]
    destination = f' href="{escape(url)}"' if url else ""
    return (
        f'<a class="quicklink" data-link="{site}" data-label="{label}" aria-label="{label}"{destination} rel="noopener noreferrer">'
        f'<img src="static/sites/{icon}" alt="" /></a>'
    )


def main():
    # load modlist
    mods = json.loads((ROOT / "SITELIST.json").read_text(encoding="utf-8"))
    bubbles = []
    secondary_started = False

    # build mod grid, including links for users with js disabled
    for mod_id, mod in mods.items():
        name = escape(mod["name"])
        image = f"static/mods/platform_{mod_id}.webp"
        if not (ROOT / image).is_file():
            raise FileNotFoundError(f"Missing icon: {image}")
        colors = escape(", ".join(mod["colors"]))
        attributes = f' data-colors="{colors}"'
        fallback = ""
        for site in PLATFORMS:
            if site == "modrinth" or not mod.get(site):
                continue
            attributes += f' data-{site}="{escape(mod[site])}"'
            fallback += quicklink(site, mod[site])
        if mod.get("secondary") and not secondary_started:
            bubbles.append(
                '<div class="mod-divider" role="separator" aria-label="More mods"></div>'
            )
            secondary_started = True
        secondary = " secondary" if mod.get("secondary") else ""
        url = escape(mod["modrinth"])
        bubbles.append(
            f'<div><a class="bubble{secondary}" href="{url}" data-name="{name}" rel="noopener noreferrer"{attributes}>'
            f'<img class="icon" src="{image}" alt="{name}" width="64" height="64" /></a>'
            f'<noscript><nav class="fallback-links" aria-label="More links for {name}">{fallback}</nav></noscript></div>'
        )

    # fill page template
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    replacements = {
        "<!-- MODS AUTOINSERT -->": "\n".join(bubbles),
        "<!-- QUICKLINKS AUTOINSERT -->": "\n".join(quicklink(site) for site in PLATFORMS),
    }
    for marker, content in replacements.items():
        if html.count(marker) != 1:
            raise ValueError(f"Expected exactly one {marker} placeholder")
        html = html.replace(marker, content)

    # clear previous build after page has been generated successfully
    output = ROOT / "dist"
    if output.resolve().parent != ROOT:
        raise ValueError("Build output must stay inside the repository")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()

    # write the page and copy assets
    (output / "index.html").write_text(html, encoding="utf-8")
    for filename in ("script.js", "sound.js", "style.css", "controls.css", "favicon.ico", "robots.txt", "sitemap.xml", "CNAME"):
        shutil.copy2(ROOT / filename, output / filename)
    shutil.copytree(ROOT / "static", output / "static")


if __name__ == "__main__":
    main()
