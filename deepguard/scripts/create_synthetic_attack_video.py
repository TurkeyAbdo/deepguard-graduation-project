from __future__ import annotations

import argparse
import io
import struct
from pathlib import Path

from PIL import Image


FPS = 15
FRAME_SIZE = (640, 640)


def write_chunk(handle, chunk_id: bytes, payload: bytes) -> None:
    handle.write(chunk_id)
    handle.write(struct.pack("<I", len(payload)))
    handle.write(payload)
    if len(payload) % 2:
        handle.write(b"\0")


def start_list(handle, list_type: bytes) -> int:
    handle.write(b"LIST")
    size_position = handle.tell()
    handle.write(b"\0\0\0\0")
    handle.write(list_type)
    return size_position


def finish_sized_block(handle, size_position: int) -> None:
    end_position = handle.tell()
    size = end_position - size_position - 4
    handle.seek(size_position)
    handle.write(struct.pack("<I", size))
    handle.seek(end_position)


def crop_panels(sheet: Image.Image) -> dict[str, Image.Image]:
    width, height = sheet.size
    half_x, half_y = width // 2, height // 2
    inset = max(2, width // 600)
    boxes = {
        "neutral": (inset, inset, half_x - inset, half_y - inset),
        "blink": (half_x + inset, inset, width - inset, half_y - inset),
        "turn": (inset, half_y + inset, half_x - inset, height - inset),
        "smile": (half_x + inset, half_y + inset, width - inset, height - inset),
    }
    return {
        name: sheet.crop(box).resize(FRAME_SIZE, Image.Resampling.LANCZOS).convert("RGB")
        for name, box in boxes.items()
    }


def build_timeline(panels: dict[str, Image.Image]) -> list[Image.Image]:
    frames: list[Image.Image] = []

    def hold(name: str, count: int) -> None:
        frames.extend([panels[name]] * count)

    def transition(start: str, end: str, count: int = 5) -> None:
        for step in range(1, count + 1):
            frames.append(Image.blend(panels[start], panels[end], step / (count + 1)))

    hold("neutral", 20)
    transition("neutral", "blink")
    hold("blink", 20)
    transition("blink", "neutral")
    hold("neutral", 8)
    transition("neutral", "turn")
    hold("turn", 25)
    transition("turn", "neutral")
    hold("neutral", 8)
    transition("neutral", "smile")
    hold("smile", 25)
    transition("smile", "neutral")
    hold("neutral", 10)
    return frames


def jpeg_bytes(frame: Image.Image) -> bytes:
    buffer = io.BytesIO()
    frame.save(buffer, format="JPEG", quality=90, subsampling=0)
    return buffer.getvalue()


def write_mjpeg_avi(path: Path, frames: list[Image.Image]) -> None:
    encoded = [jpeg_bytes(frame) for frame in frames]
    width, height = FRAME_SIZE
    largest_frame = max(map(len, encoded))

    with path.open("w+b") as handle:
        handle.write(b"RIFF")
        riff_size_position = handle.tell()
        handle.write(b"\0\0\0\0")
        handle.write(b"AVI ")

        hdrl_size_position = start_list(handle, b"hdrl")
        avih = struct.pack(
            "<IIIIIIIIII4I",
            round(1_000_000 / FPS),
            largest_frame * FPS,
            0,
            0x10,
            len(encoded),
            0,
            1,
            largest_frame,
            width,
            height,
            0,
            0,
            0,
            0,
        )
        write_chunk(handle, b"avih", avih)

        strl_size_position = start_list(handle, b"strl")
        strh = struct.pack(
            "<4s4sIHHIIIIIIIIhhhh",
            b"vids",
            b"MJPG",
            0,
            0,
            0,
            0,
            1,
            FPS,
            0,
            len(encoded),
            largest_frame,
            0xFFFFFFFF,
            0,
            0,
            0,
            width,
            height,
        )
        write_chunk(handle, b"strh", strh)
        strf = struct.pack(
            "<IiiHH4sIiiII",
            40,
            width,
            height,
            1,
            24,
            b"MJPG",
            width * height * 3,
            0,
            0,
            0,
            0,
        )
        write_chunk(handle, b"strf", strf)
        finish_sized_block(handle, strl_size_position)
        finish_sized_block(handle, hdrl_size_position)

        movi_size_position = start_list(handle, b"movi")
        movi_type_position = movi_size_position + 4
        index_entries: list[tuple[int, int]] = []
        for payload in encoded:
            chunk_position = handle.tell()
            write_chunk(handle, b"00dc", payload)
            index_entries.append((chunk_position - movi_type_position, len(payload)))
        finish_sized_block(handle, movi_size_position)

        index_payload = b"".join(
            struct.pack("<4sIII", b"00dc", 0x10, offset, size)
            for offset, size in index_entries
        )
        write_chunk(handle, b"idx1", index_payload)
        finish_sized_block(handle, riff_size_position)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(args.source).convert("RGB")
    panels = crop_panels(sheet)
    for name, panel in panels.items():
        panel.save(args.output_dir / f"synthetic_{name}.png")

    frames = build_timeline(panels)
    write_mjpeg_avi(args.output_dir / "synthetic_deepfake_attack_demo.avi", frames)
    frames[0].save(
        args.output_dir / "synthetic_deepfake_attack_demo.gif",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / FPS),
        loop=0,
        optimize=False,
    )
    print(f"Created {len(frames)} frames at {FPS} FPS ({len(frames) / FPS:.2f} seconds).")


if __name__ == "__main__":
    main()
