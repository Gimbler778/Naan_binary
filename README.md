# Naan Binary: Recipe Generation + Nutrition Prediction

This project trains a multitask FLAN-T5 model on recipe data from `cleaned_recipes.csv`.

The pipeline does two tasks at once:

- Generate recipe text (name + step-by-step instructions) from ingredients.
- Predict per-serving nutrition values (calories, fat, protein, etc.) with a regression head.

## Project Files

- `info.ipynb`: End-to-end notebook (load data, preprocess, train, infer).
- `cleaned_recipes.csv`: Source dataset (kept local, not tracked in Git).
- `requirements.txt`: Python dependencies.
- `.gitignore`: Excludes large data, checkpoints, and local artifacts.
- `docs/TRAINING_AND_PREPROCESSING.md`: Detailed documentation of the full pipeline.
- `DATASET.md`: Dataset handling and large-file strategy for GitHub.

## Quick Start

## 1) Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2) Install dependencies

```powershell
pip install -r requirements.txt
```

## 3) Place dataset in project root

Expected file path:

- `cleaned_recipes.csv`

## 4) Run notebook

```powershell
jupyter notebook info.ipynb
```

Run cells top-to-bottom.

## Training Defaults in Notebook

Current notebook defaults are tuned for local experimentation:

- Model: `google/flan-t5-small`
- Subsample size: `MAX_ROWS = 30000`
- Steps: `max_steps = 120`

For better quality, increase data/steps after confirming your system can handle it.

## Notes on Large Files

`cleaned_recipes.csv` is intentionally ignored in `.gitignore` to avoid GitHub file size issues.

See `DATASET.md` for options:

- Keep full CSV local and share only code.
- Share a smaller sample CSV.
- Use Git LFS for large dataset versioning.

## Troubleshooting

- If a package import fails in the notebook, reinstall with:

```powershell
pip install -r requirements.txt
```

- If training is slow, reduce:
  - `MAX_ROWS`
  - `max_steps`
  - batch sizes

- If you have a GPU, PyTorch CUDA installation usually gives large speedups.
