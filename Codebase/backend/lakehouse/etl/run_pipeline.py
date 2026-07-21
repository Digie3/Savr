import subprocess
import sys
import os

BASE = os.path.dirname(__file__)

scripts = [
    "bronze.py",
    "silver.py",
    "gold.py"
]

for script in scripts:

    print(f"Running {script}...")

    result = subprocess.run(
        [sys.executable, os.path.join(BASE, script)]
    )

    if result.returncode != 0:
        print(f"{script} failed.")
        sys.exit(result.returncode)

print("Lakehouse updated successfully.")