from __future__ import annotations

import base64
import io
import time
from typing import List, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from PIL import Image, ImageFilter, ImageDraw


class BBox(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class Detection(BaseModel):
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    bbox: BBox


class DetectRequest(BaseModel):
    image_b64: str
    detections: List[Detection] = Field(default_factory=list)
    apply_privacy_filters: bool = True
    privacy_mode: Literal["blur", "redact"] = "blur"


class DetectResponse(BaseModel):
    ts_ms: int
    detection_count: int
    detections: List[Detection]
    filtered_image_b64: str | None


app = FastAPI(title="harpy-detect", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "harpy-detect"}


@app.post("/detect", response_model=DetectResponse)
def detect(req: DetectRequest) -> DetectResponse:
    try:
        raw = base64.b64decode(req.image_b64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"invalid image payload: {exc}")

    filtered = image.copy()
    if req.apply_privacy_filters:
        for det in req.detections:
            _apply_privacy_filter(filtered, det.bbox, req.privacy_mode)

    filtered_image_b64 = None
    if req.apply_privacy_filters:
        output = io.BytesIO()
        filtered.save(output, format="JPEG", quality=88)
        filtered_image_b64 = base64.b64encode(output.getvalue()).decode("utf-8")

    return DetectResponse(
        ts_ms=int(time.time() * 1000),
        detection_count=len(req.detections),
        detections=req.detections,
        filtered_image_b64=filtered_image_b64,
    )


def _apply_privacy_filter(image: Image.Image, bbox: BBox, mode: str) -> None:
    left = bbox.x
    top = bbox.y
    right = min(bbox.x + bbox.width, image.width)
    bottom = min(bbox.y + bbox.height, image.height)
    if left >= right or top >= bottom:
        return

    region = image.crop((left, top, right, bottom))

    if mode == "redact":
        draw = ImageDraw.Draw(image)
        draw.rectangle([left, top, right, bottom], fill=(0, 0, 0))
        return

    blurred = region.filter(ImageFilter.GaussianBlur(radius=12))
    image.paste(blurred, (left, top, right, bottom))
