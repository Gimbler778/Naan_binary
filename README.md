# Naan Binary: Recipe Generation + Nutrition Prediction

This project trains a multitask FLAN-T5 pipeline on `cleaned_recipes.csv` to:

- Generate recipe text (name + steps) from ingredients.
- Predict per-serving nutrition values.

The notebook also includes:

- A dedicated nutrition regressor (separate from the language model head).
- Recipe validity scoring and reranking for generated candidates.
- GPU-aware training/evaluation settings (AMP, TF32, dataloader tuning).

## Project Files

- `info.ipynb`: End-to-end workflow (data prep, training, evaluation, inference).
- `cleaned_recipes.csv`: Source dataset (kept local, not tracked in Git).
- `requirements.txt`: Python dependencies.
- `DATASET.md`: Dataset handling and large-file strategy for GitHub.
- `docs/TRAINING_AND_PREPROCESSING.md`: Additional pipeline notes.

## Environment Setup (venv)

## 1) Create a virtual environment

Windows (PowerShell or CMD):

```powershell
python -m venv .venv
```

## 2) Activate virtual environment

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
.venv\Scripts\activate.bat
```

Linux/macOS:

```bash
source .venv/bin/activate
```

## 3) Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

## 4) Verify PyTorch + GPU (optional but recommended)

```bash
python -c "import torch; print('cuda:', torch.cuda.is_available()); print('device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu')"
```

## 5) Run the notebook

```bash
jupyter notebook info.ipynb
```

Run cells top-to-bottom.

## Current Notebook Behavior

- Base model: `google/flan-t5-small`
- Uses all prepared rows by default (`MAX_ROWS = len(df_work)`).
- Nutrition targets include log transform for heavy-tailed columns:
  - `Calories`
  - `SodiumContent`
  - `CholesterolContent`
- Multitask training uses weighted regression + sequence generation loss.
- Dedicated nutrition regressor is trained/evaluated separately for numeric prediction quality.
- Generation uses candidate reranking with recipe-validity heuristics.

## GPU Optimization Included

The notebook auto-configures the following when CUDA is available:

- Mixed precision (`bf16` if supported, otherwise `fp16`).
- TF32 acceleration for matrix multiplications.
- cuDNN benchmark enabled.
- Dataloader workers + pinned memory.
- Gradient checkpointing and eval accumulation for 8 GB class GPUs.

You can monitor GPU usage during training with:

```bash
nvidia-smi
```

## Recommended Run Order

1. Data load/import cells.
2. Preprocessing and dataset build cells.
3. Model definition + sanity check.
4. Main training cell.
5. Validation metrics cell.
6. Dedicated nutrition regressor cell.
7. Final inference/recipe generation cell.

## Outputs and Checkpoints

- Training artifacts are written under `recipe_multitask_ckpt/`.
- Best model by eval loss is saved as:
  - `recipe_multitask_ckpt/best_eval_loss_model.pt`

## Notes on Large Files

`cleaned_recipes.csv` is intentionally ignored in `.gitignore`.

See `DATASET.md` for options:

- Keep full CSV local and share code only.
- Share a sampled CSV for collaboration.
- Use Git LFS if your workflow requires dataset versioning.

## Troubleshooting

- If imports fail:

```bash
pip install -r requirements.txt
```

- If GPU is not detected, install a CUDA-enabled PyTorch build for your system.

- If you hit CUDA OOM:
  - Lower `per_device_train_batch_size`.
  - Increase `gradient_accumulation_steps`.
  - Reduce eval batch size.

## Deactivate venv

```bash
deactivate
```
