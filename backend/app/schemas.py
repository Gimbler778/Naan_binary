from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    ingredients: list[str] = Field(..., min_length=1, description="List of ingredients")
    total_minutes: float = Field(default=0.0, ge=0.0)
    servings: float = Field(default=4.0, gt=0.0)
    num_candidates: int = Field(default=4, ge=1, le=8)
    max_new_tokens: int = Field(default=220, ge=32, le=384)


class RecipeCandidate(BaseModel):
    text: str
    score: float


class PredictResponse(BaseModel):
    input_text: str
    recipe_text: str
    nutrition: dict[str, float]
    candidates: list[RecipeCandidate]


class EvaluateRequest(BaseModel):
    generated_recipe: str = Field(..., min_length=1, description="Generated recipe text")
    reference_recipe: str = Field(..., min_length=1, description="Reference recipe text")
    ingredients: list[str] = Field(default_factory=list, description="Optional ingredient list used as prompt")


class EvaluateResponse(BaseModel):
    metrics: dict[str, float]
    verdict: str


class EvaluateAutoRequest(BaseModel):
    generated_recipe: str = Field(..., min_length=1, description="Generated recipe text")
    ingredients: list[str] = Field(default_factory=list, description="Ingredients used for generation")


class EvaluateAutoResponse(BaseModel):
    metrics: dict[str, float]
    verdict: str
    reference_name: str
    reference_recipe: str
    reference_ingredient_match: float
