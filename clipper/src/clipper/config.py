"""Load and validate config.yaml into typed settings.

Config-driven by design: every tunable (clip count, durations, thresholds,
branding, model id) lives in config.yaml so the pipeline code stays generic.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field


class ChurchCfg(BaseModel):
    name: str
    short_name: str
    website: str
    cta: str


class SourceCfg(BaseModel):
    default: str
    boxcast_channel_id: str
    boxcast_channel_url: str
    select: str = "latest_completed"
    name_filter: Optional[str] = None


class BrandingCfg(BaseModel):
    logo_path: str = "assets/kbcf-logo.png"
    logo_position: str = "top-left"
    caption_font: str = "Montserrat-Bold"
    emphasis_color: Optional[str] = None  # null => derive from logo
    primary_color: Optional[str] = None  # null => derive from logo


class ClipsCfg(BaseModel):
    count_per_sermon: int = 4
    min_seconds: int = 30
    max_seconds: int = 90
    score_threshold: int = 10
    aspect_ratios: list[str] = Field(default_factory=lambda: ["9:16"])
    hook_reemphasis: bool = True


class OutputCfg(BaseModel):
    dir: str = "output/{broadcast_date}"
    review_gallery: bool = True


class ApiCfg(BaseModel):
    model: str = "claude-sonnet-4-6"


class Config(BaseModel):
    church: ChurchCfg
    source: SourceCfg
    branding: BrandingCfg
    clips: ClipsCfg
    output: OutputCfg
    api: ApiCfg

    # Absolute project root (dir containing config.yaml). Not from YAML.
    root: Path = Field(default_factory=Path.cwd, exclude=True)

    @classmethod
    def load(cls, path: str | Path = "config.yaml") -> "Config":
        p = Path(path).resolve()
        data = yaml.safe_load(p.read_text(encoding="utf-8"))
        cfg = cls.model_validate(data)
        cfg.root = p.parent
        return cfg

    # ---- path helpers (everything resolves relative to project root) ---- #

    def path(self, rel: str | Path) -> Path:
        rel = Path(rel)
        return rel if rel.is_absolute() else (self.root / rel)

    @property
    def logo_path(self) -> Path:
        return self.path(self.branding.logo_path)

    def output_dir(self, broadcast_date: str) -> Path:
        return self.path(self.output.dir.format(broadcast_date=broadcast_date))
