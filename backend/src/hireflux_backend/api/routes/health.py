from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Process liveness only; database readiness is intentionally separate."""
    return {"status": "ok"}
