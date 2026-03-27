# Training and Preprocessing Documentation

This document explains the notebook pipeline in `info.ipynb`.

## 1. Data Loading

The notebook loads:

- `cleaned_recipes.csv` into a pandas DataFrame.

Main raw columns used:

- `RecipeIngredientParts`
- `RecipeInstructions`
- `TotalTime`
- `RecipeServings`
- Nutrition columns:
  - `Calories`
  - `FatContent`
  - `SaturatedFatContent`
  - `CholesterolContent`
  - `SodiumContent`
  - `CarbohydrateContent`
  - `FiberContent`
  - `SugarContent`
  - `ProteinContent`

## 2. Parsing and Cleaning

### 2.1 Ingredient and instruction parsing

The dataset stores list-like fields in Food.com style text like:

- `c("blueberries", "sugar")`

The notebook parser converts these to Python lists.

### 2.2 Time parsing

`TotalTime` is parsed from ISO-8601 duration strings such as:

- `PT30M`
- `PT1H15M`
- `P1DT2H`

Converted output is total minutes.

### 2.3 Ingredient normalization

Each ingredient token is normalized by:

- Lowercasing.
- Removing parenthetical text.
- Stripping quantity and common unit prefixes.
- Removing non-alphabetic noise.
- Deduplicating while preserving order.

The input prompt is built as:

- `ingredients: a, b, c | ready_in_min: X`

### 2.4 Target text generation

Target sequence is built as:

- `name: <recipe name>`
- `steps:` followed by numbered instructions.

## 3. Nutrition Target Preparation

- `RecipeServings` is converted to numeric.
- Missing servings are filled with dataset median.
- Servings are clipped to at least 1.0.
- Nutrition values are converted to per-serving values by division.

Rows with missing nutrition targets are dropped.

## 4. Train/Validation Split and Scaling

- Data is split into train/validation.
- `StandardScaler` is fit on training nutrition targets only.
- Validation targets are transformed with the same scaler.

This avoids data leakage.

## 5. Model Architecture

The model wraps FLAN-T5 with multitask outputs:

- Backbone: `T5ForConditionalGeneration`
- Task A (generation): sequence-to-sequence recipe generation.
- Task B (regression): MLP regression head over pooled encoder hidden state.

Total loss:

- `Loss = CE_loss + reg_weight * MSE_loss`

where:

- `CE_loss` is text generation cross-entropy.
- `MSE_loss` is nutrition regression mean squared error.

## 6. Training Configuration

Default notebook setup is intended for practical local runs:

- Model: `google/flan-t5-small`
- Row cap: `MAX_ROWS = 30000`
- Training steps: `max_steps = 120`
- Save strategy: `no` (to avoid custom wrapper checkpoint serialization issues)

## 7. Inference

For one validation sample:

- Generate recipe text via `generate`.
- Predict scaled nutrition values with regression head.
- Inverse-transform to original nutrition scale.
- Print predicted vs ground truth nutrition.

## 8. Recommended Improvements

- Add robust metric reporting:
  - Text: ROUGE/BLEU
  - Regression: MAE/RMSE
- Add explicit model save/load helpers for custom wrapper + scaler.
- Add a script version of notebook flow for reproducible CLI training.
- Add experiment tracking (for example, MLflow or Weights and Biases).

## 9. Reproducibility Notes

- Random seeds are set in notebook.
- Exact results can vary by hardware and package versions.
- Keep dependency versions from `requirements.txt` for closer reproducibility.
