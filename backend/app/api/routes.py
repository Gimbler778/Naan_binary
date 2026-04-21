from fastapi import APIRouter, HTTPException

from app.core.evaluation import evaluate_recipe_pair, evaluate_with_auto_reference, quality_verdict
from app.core.model_service import get_model_service
from app.schemas import (
    EvaluateAutoRequest,
    EvaluateAutoResponse,
    EvaluateRequest,
    EvaluateResponse,
    PredictRequest,
    PredictResponse,
)

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


@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate(payload: EvaluateRequest) -> EvaluateResponse:
    try:
        metrics = evaluate_recipe_pair(
            generated_recipe=payload.generated_recipe,
            reference_recipe=payload.reference_recipe,
            ingredients=payload.ingredients,
        )
        return EvaluateResponse(metrics=metrics, verdict=quality_verdict(metrics["overall_quality_score"]))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {exc}") from exc


@router.post("/evaluate-auto", response_model=EvaluateAutoResponse)
def evaluate_auto(payload: EvaluateAutoRequest) -> EvaluateAutoResponse:
    try:
        result = evaluate_with_auto_reference(
            generated_recipe=payload.generated_recipe,
            ingredients=payload.ingredients,
        )
        return EvaluateAutoResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Auto evaluation failed: {exc}") from exc
