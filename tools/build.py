"""Build script for Network Simulator.

  python tools/build.py              -> refresh index.html script list + build dist/network-simulator.html
  python tools/build.py --vault      -> also copy the single-file build into the Obsidian vault

index.html loads css/ and js/ directly (works on GitHub Pages and when double-clicked).
dist/network-simulator.html is one self-contained file (CSS + JS inlined) for offline use / Obsidian.
"""
import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT_COPY = r"G:\My Drive\Sudipto's Vault\07_Templates\Network Diagram Builder.html"


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8", newline="\n").write(text)


def main():
    scripts = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "js", "*.js")))

    # 1) keep index.html's <script> list in sync with the files in js/
    index_path = os.path.join(ROOT, "index.html")
    index = read(index_path)
    tags = "\n".join(f'<script src="js/{name}"></script>' for name in scripts)
    index = re.sub(r"<!-- scripts:start -->.*?<!-- scripts:end -->",
                   "<!-- scripts:start -->\n" + tags + "\n<!-- scripts:end -->", index, flags=re.S)
    write(index_path, index)

    # 2) single-file build: inline the stylesheet and every script
    css = read(os.path.join(ROOT, "css", "style.css"))
    js = "\n".join(read(os.path.join(ROOT, "js", n)) for n in scripts)
    single = index.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
    single = re.sub(r"<!-- scripts:start -->.*?<!-- scripts:end -->",
                    lambda m: "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>", single, flags=re.S)
    out = os.path.join(ROOT, "dist", "network-simulator.html")
    write(out, single)
    print(f"built {out} ({len(single):,} bytes, {len(scripts)} scripts)")

    if "--vault" in sys.argv:
        write(VAULT_COPY, single)
        print(f"copied to {VAULT_COPY}")


if __name__ == "__main__":
    main()
