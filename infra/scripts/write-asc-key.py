"""Writes the App Store Connect API key from $ASC_KEY_P8 as a clean PEM file.

Pasted secrets often lose their shape: CRLF line endings, quotes, missing
BEGIN/END lines, newlines collapsed into spaces, or the whole .p8 file in
base64. Rebuild the PEM from whatever base64 body is present. Never prints
the key.
"""
import base64
import os
import re
import sys

raw = os.environ.get("ASC_KEY_P8", "").strip().strip('"').strip("'")
raw = raw.replace("\\n", "\n").replace("\r", "")
body = re.sub(r"-----(BEGIN|END)[A-Z ]*-----", "", raw)
body = re.sub(r"\s+", "", body)
try:
    decoded = base64.b64decode(body, validate=True)
except Exception:
    sys.exit("ASC_KEY_P8 is not a .p8 key: paste the whole AuthKey_XXXX.p8 file text.")
# A secret holding the base64 of the whole .p8 file decodes to PEM text.
if decoded.startswith(b"-----BEGIN"):
    text = decoded.decode("ascii", "replace")
    body = re.sub(r"\s+", "", re.sub(r"-----(BEGIN|END)[A-Z ]*-----", "", text))
    decoded = base64.b64decode(body)
if not (decoded[:1] == b"\x30" and 60 <= len(decoded) <= 400):
    sys.exit("ASC_KEY_P8 does not look like an App Store Connect private key (.p8).")
lines = [body[i : i + 64] for i in range(0, len(body), 64)]
pem = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(lines) + "\n-----END PRIVATE KEY-----\n"
with open(sys.argv[1], "w", encoding="ascii") as handle:
    handle.write(pem)
print(f"App Store Connect key written ({len(decoded)} bytes DER).")
