from fastapi import APIRouter, HTTPException

from app.core.model_service import get_model_service
from app.schemas import PredictRequest, PredictResponse

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    try:
        service = get_model_service()
        result = service.predict(
            ingredients=payload.ingredients,
            total_minutes=payload.total_minutes,
            servings=payload.servings,
            num_candidates=payload.num_candidates,
            max_new_tokens=payload.max_new_tokens,
        )
        return PredictResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
