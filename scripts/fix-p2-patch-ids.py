from pathlib import Path
import runpy

patch = Path('scripts/patch-gameplay-p2.py')
text = patch.read_text()
text = text.replace("    'railshift',\n", "    'neonrail',\n")
text = text.replace("    'knife',\n", "    'knifetarget',\n")
patch.write_text(text)
runpy.run_path(str(patch), run_name='__main__')
