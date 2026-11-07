#!/usr/bin/env python3
"""Gives a thin 64-bit Mach-O executable a stable UUID derived from a seed string.

macOS Local Network privacy identifies a program by its Mach-O UUID. Every Electron app on the same
Electron version ships byte-identical executables, so without this the fork shares the official
T3 Code app's UUID, macOS matches it to that app's permission record, and denies it without asking.

Usage: set-macho-uuid.py <executable> <seed>
The executable must be re-signed afterwards; patching invalidates its signature.
"""

import struct
import sys
import uuid

MH_MAGIC_64 = 0xFEEDFACF
LC_UUID = 0x1B
MACH_HEADER_64_SIZE = 32


def main() -> None:
    path, seed = sys.argv[1], sys.argv[2]
    new_uuid = uuid.uuid5(uuid.NAMESPACE_URL, seed)
    with open(path, "rb") as file:
        data = bytearray(file.read())

    if struct.unpack_from("<I", data, 0)[0] != MH_MAGIC_64:
        sys.exit(f"{path}: not a thin 64-bit Mach-O executable")

    command_count = struct.unpack_from("<I", data, 16)[0]
    offset = MACH_HEADER_64_SIZE
    for _ in range(command_count):
        command, size = struct.unpack_from("<II", data, offset)
        if command == LC_UUID:
            data[offset + 8 : offset + 24] = new_uuid.bytes
            with open(path, "wb") as file:
                file.write(data)
            print(f"{path}: UUID {str(new_uuid).upper()}")
            return
        offset += size

    sys.exit(f"{path}: no LC_UUID load command")


if __name__ == "__main__":
    main()
