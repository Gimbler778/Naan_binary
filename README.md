# Naan Binary

Recipe generation and nutrition prediction project with:

1. Notebook training/inference pipeline.
2. FastAPI backend for model serving.
3. React frontend for interactive UI.

## Current Status

1. Notebook pipeline is available in `Naan_binary_v2.ipynb`.
2. Backend is implemented under `backend/` with `/api/health` and `/api/predict`.
3. Frontend is implemented under `frontend/` and connected to the backend.
4. Repository is configured to ignore large/generated artifacts for GitHub.

## Project Structure

1. `Naan_binary_v2.ipynb`: Main updated notebook pipeline.
2. `backend/`: FastAPI app and inference service.
3. `frontend/`: React + Vite UI.
4. `requirements.txt`: Root notebook/training dependencies.
5. `backend/requirements.txt`: Backend API/runtime dependencies.
6. `DATASET.md`: Dataset notes.
7. `docs/TRAINING_AND_PREPROCESSING.md`: Additional training details.

## Environment Setup (Windows)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

## Notebook Setup

```powershell
pip install -r requirements.txt
jupyter notebook Naan_binary_v2.ipynb
```

## Backend Setup and Run

```powershell
cd backend
..\dl_env\Scripts\python -m pip install -r requirements.txt
..\dl_env\Scripts\python run.py
```

API docs: `http://127.0.0.1:8000/docs`

## Frontend Setup and Run

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Model and Data Files

Large model artifacts and datasets are intentionally ignored from git.

1. Keep `cleaned_recipes.csv` local.
2. Keep generated checkpoints local (`recipe_multitask_ckpt/`, `recipe_checkpoints/`, `recipe_model_final/`).
3. Keep deployed backend model files local under `backend/assets/model_final/`.

If you need to version large files, use Git LFS or a cloud artifact store.

## Pre-Push Checklist

1. Confirm `.gitignore` is applied.
2. Run backend health check: `GET /api/health`.
3. Run one prediction through UI or `POST /api/predict`.
4. Verify no large artifacts are staged.

## Push to GitHub

```powershell
git status
git add .
git commit -m "Prepare repository for GitHub: ignore large artifacts, update docs and deps"
git push -u origin deployment
```

If your branch name is different, replace `deployment` with your branch.
