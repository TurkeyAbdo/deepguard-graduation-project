from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from create_synthetic_attack_video import FPS, FRAME_SIZE, crop_panels, write_mjpeg_avi


STEPS = [
    ("BLINK", "Blink once"),
    ("CENTER", "Face forward"),
    ("RIGHT", "Turn right"),
    ("LEFT", "Turn left"),
    ("RECENTER", "Face forward"),
    ("NEAR/FAR", "Move closer"),
    ("SMILE", "Smile"),
]


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    filename = "segoeuib.ttf" if bold else "segoeui.ttf"
    try:
        return ImageFont.truetype(f"C:/Windows/Fonts/{filename}", size)
    except OSError:
        return ImageFont.load_default()


def centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    value: str,
    text_font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
) -> None:
    bounds = draw.textbbox((0, 0), value, font=text_font)
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = box[0] + (box[2] - box[0] - width) / 2
    y = box[1] + (box[3] - box[1] - height) / 2 - bounds[1]
    draw.text((x, y), value, font=text_font, fill=fill)


def zoom_frame(frame: Image.Image, scale: float = 1.18) -> Image.Image:
    width, height = frame.size
    resized = frame.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def add_guide(frame: Image.Image, active_step: int) -> Image.Image:
    canvas = frame.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = canvas.size

    draw.rectangle((0, 0, width, 54), fill=(10, 12, 14, 205))
    draw.text((18, 10), "SYNTHETIC LIVENESS DEMO", font=font(14, True), fill=(255, 255, 255, 255))
    draw.text((18, 30), STEPS[active_step][1], font=font(13), fill=(191, 198, 205, 255))

    guide_top = height - 92
    draw.rectangle((0, guide_top, width, height), fill=(10, 12, 14, 220))
    cell_width = width / len(STEPS)
    small_font = font(10, True)
    number_font = font(12, True)

    for index, (short_label, _) in enumerate(STEPS):
        left = round(index * cell_width)
        right = round((index + 1) * cell_width)
        if index > 0:
            draw.line((left, guide_top + 12, left, height - 12), fill=(76, 82, 88, 190), width=1)

        if index < active_step:
            color = (94, 213, 162, 255)
        elif index == active_step:
            color = (255, 255, 255, 255)
            draw.rectangle((left, guide_top, right, guide_top + 3), fill=color)
            draw.rectangle((left + 2, guide_top + 4, right - 2, height - 2), fill=(255, 255, 255, 20))
        else:
            color = (113, 121, 129, 255)

        circle_x = (left + right) // 2
        circle_y = guide_top + 28
        radius = 13
        draw.ellipse(
            (circle_x - radius, circle_y - radius, circle_x + radius, circle_y + radius),
            outline=color,
            width=2,
        )
        centered_text(
            draw,
            (circle_x - radius, circle_y - radius, circle_x + radius, circle_y + radius),
            str(index + 1),
            number_font,
            color,
        )
        centered_text(draw, (left + 2, guide_top + 49, right - 2, height - 5), short_label, small_font, color)

    return Image.alpha_composite(canvas, overlay).convert("RGB")


def build_step_timeline(panels: dict[str, Image.Image]) -> tuple[list[Image.Image], list[Image.Image]]:
    neutral = panels["neutral"]
    blink = panels["blink"]
    right = panels["turn"]
    left = right.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    smile = panels["smile"]
    near = zoom_frame(neutral)

    frames: list[Image.Image] = []

    def hold(image: Image.Image, step: int, count: int) -> None:
        guided = add_guide(image, step)
        frames.extend([guided] * count)

    def transition(start: Image.Image, end: Image.Image, step: int, count: int = 5) -> None:
        for index in range(1, count + 1):
            frames.append(add_guide(Image.blend(start, end, index / (count + 1)), step))

    hold(neutral, 0, 18)
    transition(neutral, blink, 0, 3)
    hold(blink, 0, 5)
    transition(blink, neutral, 0, 3)

    hold(neutral, 1, 15)
    transition(neutral, right, 2, 5)
    hold(right, 2, 18)
    transition(right, left, 3, 8)
    hold(left, 3, 18)
    transition(left, neutral, 4, 5)
    hold(neutral, 4, 15)
    transition(neutral, near, 5, 5)
    hold(near, 5, 8)

    transition(near, neutral, 6, 5)
    hold(neutral, 6, 12)
    transition(neutral, smile, 6, 5)
    hold(smile, 6, 20)
    transition(smile, neutral, 6, 5)
    hold(neutral, 6, 10)

    key_frames = [
        add_guide(blink, 0),
        add_guide(neutral, 1),
        add_guide(right, 2),
        add_guide(left, 3),
        add_guide(neutral, 4),
        add_guide(near, 5),
        add_guide(smile, 6),
    ]
    return frames, key_frames


def save_contact_sheet(path: Path, frames: list[Image.Image]) -> None:
    thumbnail_size = (320, 320)
    sheet = Image.new("RGB", (thumbnail_size[0] * 4, thumbnail_size[1] * 2), (24, 26, 29))
    for index, frame in enumerate(frames):
        thumbnail = frame.resize(thumbnail_size, Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, ((index % 4) * thumbnail_size[0], (index // 4) * thumbnail_size[1]))
    sheet.save(path, quality=94)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    panels = crop_panels(Image.open(args.source).convert("RGB"))
    frames, key_frames = build_step_timeline(panels)

    avi_path = args.output_dir / "synthetic_liveness_steps_demo.avi"
    write_mjpeg_avi(avi_path, frames)
    save_contact_sheet(args.output_dir / "synthetic_liveness_steps_contact_sheet.jpg", key_frames)
    print(f"Created {len(frames)} frames at {FPS} FPS ({len(frames) / FPS:.2f} seconds).")


if __name__ == "__main__":
    main()
