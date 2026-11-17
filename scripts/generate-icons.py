#!/usr/bin/env python3
"""
Generate RGBA PNG icons (16x16, 48x48, 128x128) for BomBom Arcade.
Features a rounded pastel coral-to-purple gradient square with a golden star in the center.
Uses only Python 3 standard library (math, os, struct, zlib).
"""

import math
import os
import struct
import sys
import zlib


def make_png(width: int, height: int, rgba_bytes: bytes) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"

    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr_data = struct.pack(
        ">IIBBBBB",
        width,
        height,
        8,  # bit depth: 8
        6,  # color type: 6 (RGBA)
        0,  # compression method: 0 (deflate)
        0,  # filter method: 0 (standard)
        0,  # interlace: 0 (none)
    )
    ihdr_chunk = make_chunk(b"IHDR", ihdr_data)

    scanlines = bytearray()
    row_bytes = width * 4
    for y in range(height):
        scanlines.append(0)  # Filter byte: None (0)
        scanlines.extend(rgba_bytes[y * row_bytes : (y + 1) * row_bytes])

    compressed = zlib.compress(bytes(scanlines), level=9)
    idat_chunk = make_chunk(b"IDAT", compressed)
    iend_chunk = make_chunk(b"IEND", b"")

    return signature + ihdr_chunk + idat_chunk + iend_chunk


def point_in_polygon(px: float, py: float, polygon: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(polygon)
    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if min(p1y, p2y) < py <= max(p1y, p2y):
            if px <= max(p1x, p2x):
                if p1y != p2y:
                    x_inters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or px <= x_inters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def render_icon(size: int) -> bytes:
    cx = (size - 1) / 2.0
    cy = (size - 1) / 2.0

    # Rounded box parameters
    margin = size * 0.05
    box_half = (size - 2 * margin) / 2.0
    corner_radius = size * 0.22

    # Star parameters (5 points -> 10 vertices)
    star_r_outer = size * 0.30
    star_r_inner = star_r_outer * 0.44
    star_vertices = []
    for k in range(10):
        angle = -math.pi / 2.0 + k * (2.0 * math.pi / 10.0)
        radius = star_r_outer if (k % 2 == 0) else star_r_inner
        vx = cx + radius * math.cos(angle)
        vy = cy + radius * math.sin(angle)
        star_vertices.append((vx, vy))

    # Supersampling 4x4 grid per pixel
    sub_offsets = [-0.375, -0.125, 0.125, 0.375]
    samples_count = len(sub_offsets) * len(sub_offsets)

    rgba_buffer = bytearray(size * size * 4)

    for y in range(size):
        for x in range(size):
            r_sum = 0.0
            g_sum = 0.0
            b_sum = 0.0
            a_sum = 0.0

            for sy in sub_offsets:
                py = y + sy
                for sx in sub_offsets:
                    px = x + sx

                    # Check inside rounded rectangle
                    dx = max(abs(px - cx) - (box_half - corner_radius), 0.0)
                    dy = max(abs(py - cy) - (box_half - corner_radius), 0.0)
                    dist = math.sqrt(dx * dx + dy * dy) - corner_radius

                    if dist <= 0.0:
                        # Inside rounded square
                        # Check star
                        if point_in_polygon(px, py, star_vertices):
                            # Golden star color with soft vertical gradient
                            star_t = (py - (cy - star_r_outer)) / (2.0 * star_r_outer)
                            star_t = max(0.0, min(1.0, star_t))
                            sr = 255.0
                            sg = 232.0 * (1.0 - star_t) + 195.0 * star_t
                            sb = 80.0 * (1.0 - star_t) + 30.0 * star_t
                            r_sum += sr
                            g_sum += sg
                            b_sum += sb
                            a_sum += 255.0
                        else:
                            # Pastel coral to pastel purple gradient
                            grad_t = (px + py) / (2.0 * (size - 1.0))
                            grad_t = max(0.0, min(1.0, grad_t))
                            # Coral: (255, 126, 126), Purple: (142, 108, 245)
                            br = 255.0 * (1.0 - grad_t) + 142.0 * grad_t
                            bg = 126.0 * (1.0 - grad_t) + 108.0 * grad_t
                            bb = 126.0 * (1.0 - grad_t) + 245.0 * grad_t
                            r_sum += br
                            g_sum += bg
                            b_sum += bb
                            a_sum += 255.0
                    else:
                        # Outside rounded square
                        pass

            idx = (y * size + x) * 4
            rgba_buffer[idx] = int(round(r_sum / samples_count))
            rgba_buffer[idx + 1] = int(round(g_sum / samples_count))
            rgba_buffer[idx + 2] = int(round(b_sum / samples_count))
            rgba_buffer[idx + 3] = int(round(a_sum / samples_count))

    return make_png(size, size, bytes(rgba_buffer))


def read_png_dimensions(filepath: str) -> tuple[int, int]:
    with open(filepath, "rb") as f:
        data = f.read(24)
    if len(data) < 24:
        raise ValueError(f"File {filepath} is too small to be a valid PNG")
    sig = data[:8]
    if sig != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Invalid PNG signature in {filepath}")
    chunk_type = data[12:16]
    if chunk_type != b"IHDR":
        raise ValueError(f"Expected IHDR chunk in {filepath}, found {chunk_type}")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.abspath(os.path.join(script_dir, ".."))
    icons_dir = os.path.join(project_dir, "public", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 48, 128, 180, 192, 512]
    generated_files = []

    print(f"Generating PNG icons in {icons_dir}...")
    for size in sizes:
        filename = f"icon-{size}.png"
        filepath = os.path.join(icons_dir, filename)
        png_data = render_icon(size)
        with open(filepath, "wb") as f:
            f.write(png_data)
        generated_files.append((filename, filepath, size))
        print(f"  Created: {filename} ({len(png_data)} bytes)")

    print("\nVerifying PNG dimensions via IHDR chunks:")
    all_ok = True
    for filename, filepath, expected_size in generated_files:
        w, h = read_png_dimensions(filepath)
        status = "OK" if (w == expected_size and h == expected_size) else "FAIL"
        print(f"  {filename}: {w}x{h} (expected {expected_size}x{expected_size}) -> {status}")
        if w != expected_size or h != expected_size:
            all_ok = False

    if not all_ok:
        print("ERROR: PNG dimension verification failed!", file=sys.stderr)
        sys.exit(1)

    print("\nAll icons generated and verified successfully!")


if __name__ == "__main__":
    main()
