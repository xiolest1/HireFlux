from fastapi import APIRouter

from hireflux_backend.api.dependencies import IdentityDependency, UserServiceDependency
from hireflux_backend.api.schemas import UserResponse

router = APIRouter(prefix="/api/v1", tags=["profile"])


@router.get("/me", response_model=UserResponse)
def get_me(identity: IdentityDependency, service: UserServiceDependency) -> UserResponse:
    return UserResponse.from_domain(service.get_or_create_profile(identity))
