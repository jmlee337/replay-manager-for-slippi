# stolen from https://github.com/pyinstaller/pyinstaller/blob/21f72db2610fa25e9519e54838906e7861435840/PyInstaller/utils/osx.py#L283
import binascii
import os
import secrets
import sys

os.system('python3 -m pip install macholib')
from macholib.MachO import MachO
from macholib.mach_o import LC_UUID

filename = sys.argv[1]
executable = MachO(filename)
for header in executable.headers:
  uuid_cmd = [cmd for cmd in header.commands if cmd[0].cmd == LC_UUID]
  if not uuid_cmd:
    continue
  uuid_cmd = uuid_cmd[0]
  new_uuid = secrets.token_bytes(16)
  uuid_cmd[1].uuid = new_uuid
  print(binascii.hexlify(new_uuid))

with open(filename, 'rb+') as fp:
  executable.write(fp)
