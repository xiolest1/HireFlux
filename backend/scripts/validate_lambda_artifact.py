"""Validate the ZIP in a pinned official Lambda image; this does not deploy it."""

import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMAGE = (
    "public.ecr.aws/lambda/python:3.14@sha256:"
    "b81a4aa3bc1d56999090333cefea611e5a84bb4e2638c1ae4107fdc9b8622da3"
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--artifact", type=Path, default=ROOT / "artifacts/lambda/hireflux-backend-lambda.zip"
    )
    args = parser.parse_args()
    artifact = args.artifact.resolve(strict=True)
    probe = Path(__file__).with_name("lambda_artifact_probe.py").resolve(strict=True)
    # Only the ZIP and this standalone probe enter the container, never the checkout.
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "--platform",
            "linux/amd64",
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            "1000:1000",
            "--tmpfs",
            "/tmp:rw,exec,nosuid,nodev,mode=1777,size=256m",
            "--mount",
            f"type=bind,source={artifact},target=/input/artifact.zip,readonly",
            "--mount",
            f"type=bind,source={probe},target=/input/probe.py,readonly",
            "--workdir",
            "/tmp",
            "--entrypoint",
            "/var/lang/bin/python3.14",
            IMAGE,
            "-I",
            "-S",
            "-B",
            "/input/probe.py",
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
