"""Build the revised 12-page academic report from editable Markdown and evidence.
The existing viva guide is preserved unchanged.
"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('build-academic-report.py')), run_name='__main__')
