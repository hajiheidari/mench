"""Pin the official Gradle 9.3.1 checksum in Expo's generated wrapper."""
import re
import sys
from pathlib import Path

EXPECTED = 'b266d5ff6b90eada6dc3b20cb090e3731302e553a27c5d3e4df1f0d76beaff06'
# Official 9.3.1 checksum was retrieved over verified HTTPS during setup.
# Preserve a known hash; never adjust it to fit a failed artifact verification.
wrapper = Path(sys.argv[1])
text = wrapper.read_text()
if 'gradle-9.3.1-bin.zip' not in text:
    raise SystemExit('Unexpected Gradle distribution; verify its official checksum first')
match = re.search(r'^distributionSha256Sum=(.*)$', text, re.M)
if match and match.group(1).strip() != EXPECTED:
    raise SystemExit('Existing Gradle checksum differs; refusing to overwrite')
if not match:
    wrapper.write_text(text + '\ndistributionSha256Sum=' + EXPECTED + '\n')
