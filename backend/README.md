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
