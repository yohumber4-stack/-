# usage: python3 tools/grid.py out.png a.png b.png ... (2 columns)
import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f) for f in files]
w, h = ims[0].size
cols = 2
rows = (len(ims) + 1) // 2
g = Image.new('RGB', (w, h * rows // 2 if rows > 1 else h // 2))
g = Image.new('RGB', (w, (h // 2) * rows))
for i, im in enumerate(ims):
    g.paste(im.resize((w // 2, h // 2)), ((i % 2) * (w // 2), (i // 2) * (h // 2)))
g.save(out)
