# Backend API

## Run

1. Install dependencies:

```powershell
cd backend
..\dl_env\Scripts\python -m pip install -r requirements.txt
```

2. Start server:

```powershell
cd backend
..\dl_env\Scripts\python run.py
```

3. API docs:

- http://127.0.0.1:8000/docs

## Endpoints

- `GET /api/health`
- `POST /api/predict`
- `POST /api/evaluate`
- `POST /api/evaluate-auto`

### Request body example

```json
{
  "ingredients": ["flour", "yeast", "salt", "yogurt"],
  "total_minutes": 90,
  "servings": 4,
  "num_candidates": 4,
  "max_new_tokens": 220
}
```

### Evaluation request body example

```json
{
  "generated_recipe": "name: Naan\nsteps: 1) Mix flour and yogurt. 2) Rest the dough. 3) Cook on hot pan.",
  "reference_recipe": "name: Classic Naan\nsteps: 1) Mix flour, yeast, salt and yogurt. 2) Knead and rest. 3) Cook on skillet until browned.",
  "ingredients": ["flour", "yeast", "salt", "yogurt"]
}
```

The evaluation endpoint returns BLEU, chrF, ROUGE (1/2/L), ingredient coverage, and a combined `overall_quality_score` with a verdict.

### Automatic evaluation request body example

```json
{
  "generated_recipe": "name: Lemon Chicken\nsteps: 1) Mix garlic and lemon. 2) Coat chicken. 3) Bake.",
  "ingredients": ["chicken breast", "garlic", "lemon", "olive oil", "rosemary"]
}
```

This endpoint automatically finds the closest reference recipe from the dataset using ingredient overlap, then returns the same metric set and verdict.
