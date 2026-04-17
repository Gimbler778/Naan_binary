from __future__ import annotations

import ast
import csv
import os
import re
from functools import lru_cache
from io import StringIO

from rouge_score import rouge_scorer
from sacrebleu import corpus_bleu, corpus_chrf


ACTION_VERBS = {
    "add",
    "mix",
    "stir",
    "heat",
    "cook",
    "bake",
    "boil",
    "simmer",
    "saute",
    "fry",
    "chop",
    "slice",
    "season",
    "serve",
    "preheat",
    "whisk",
    "knead",
    "rest",
    "marinate",
}

UNIT_WORDS = {
    "tsp",
    "teaspoon",
    "teaspoons",
    "tbsp",
    "tablespoon",
    "tablespoons",
    "cup",
    "cups",
    "oz",
    "ounce",
    "ounces",
    "lb",
    "lbs",
    "pound",
    "pounds",
    "g",
    "gram",
    "grams",
    "kg",
    "ml",
    "l",
    "liter",
    "liters",
    "pinch",
    "dash",
    "clove",
    "cloves",
    "slice",
    "slices",
    "can",
    "cans",
    "package",
    "packages",
}


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z]+", text.lower())


def _normalize_ingredient(token: str) -> str:
    s = token.lower().strip()
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"^\s*(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)\s*", "", s)
    parts = s.split()
    while parts and re.fullmatch(r"\d+(?:\.\d+)?", parts[0]):
        parts.pop(0)
    while parts and parts[0] in UNIT_WORDS:
        parts.pop(0)
    s = " ".join(parts)
    s = re.sub(r"[^a-zA-Z\s-]", " ", s)
    return re.sub(r"\s+", " ", s).strip(" -")


def _parse_list_like(value: str) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = ast.literal_eval(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass

    if text.startswith("c(") and text.endswith(")"):
        inner = text[2:-1].strip()
        reader = csv.reader(StringIO(inner), delimiter=",", quotechar='"', skipinitialspace=True)
        row = next(reader, [])
        return [x.strip().strip('"').replace('""', '"') for x in row if x.strip()]

    return [text]


def _build_recipe_text(name: str, steps: list[str]) -> str:
    title = str(name or "").strip() or "Reference Recipe"
    cleaned_steps = [re.sub(r"\s+", " ", s).strip() for s in steps if re.sub(r"\s+", " ", s).strip()]
    numbered = " ".join(f"{i + 1}) {step}" for i, step in enumerate(cleaned_steps[:20]))
    return f"name: {title} steps: {numbered}".strip()


@lru_cache(maxsize=1)
def _load_reference_pool() -> list[dict[str, object]]:
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    csv_path = os.path.join(repo_root, "cleaned_recipes.csv")
    if not os.path.exists(csv_path):
        return []

    records: list[dict[str, object]] = []
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            if idx >= 50000:
                break
            ing_raw = row.get("RecipeIngredientParts", "")
            steps_raw = row.get("RecipeInstructions", "")
            name = row.get("Name", "")

            ingredients = [_normalize_ingredient(x) for x in _parse_list_like(ing_raw)]
            ingredients = [x for x in ingredients if x]
            ingredient_set = set(ingredients)

            steps = _parse_list_like(steps_raw)
            recipe_text = _build_recipe_text(name, steps)

            if ingredient_set and recipe_text:
                records.append(
                    {
                        "name": str(name or "").strip() or "Reference Recipe",
                        "ingredients": ingredient_set,
                        "recipe_text": recipe_text,
                    }
                )
    return records


def find_best_reference_recipe(ingredients: list[str]) -> dict[str, object] | None:
    pool = _load_reference_pool()
    if not pool:
        return None

    input_set = {_normalize_ingredient(x) for x in ingredients}
    input_set = {x for x in input_set if x}
    if not input_set:
        return None

    best_row: dict[str, object] | None = None
    best_score = -1.0
    for row in pool:
        ref_set = row["ingredients"]
        overlap = len(input_set & ref_set)
        if overlap == 0:
            continue
        precision = overlap / max(1, len(ref_set))
        recall = overlap / max(1, len(input_set))
        score = 0.65 * recall + 0.35 * precision
        if score > best_score:
            best_score = score
            best_row = row

    if best_row is None:
        return None

    return {
        "name": best_row["name"],
        "recipe_text": best_row["recipe_text"],
        "ingredient_match": float(max(0.0, min(100.0, best_score * 100.0))),
    }


def _extract_title(text: str) -> str:
    text = _normalize_spaces(text)
    match = re.search(r"name\s*:\s*(.+?)(?:\s+steps?\s*:|$)", text, flags=re.IGNORECASE)
    if match:
        return match.group(1).strip().lower()
    return ""


def _extract_steps(text: str) -> list[str]:
    text = _normalize_spaces(text)
    body_parts = re.split(r"\bsteps?\s*:\s*", text, maxsplit=1, flags=re.IGNORECASE)
    body = body_parts[1] if len(body_parts) > 1 else text

    numbered = re.findall(
        r"(?:^|\s)\d+[\).]\s*(.*?)(?=(?:\s+\d+[\).]\s)|$)",
        body,
        flags=re.IGNORECASE,
    )
    steps = [_normalize_spaces(s) for s in numbered if _normalize_spaces(s)]
    if steps:
        return steps

    # Fallback for non-numbered recipes.
    sentence_steps = re.split(r"[.!?]\s+", body)
    return [_normalize_spaces(s) for s in sentence_steps if len(_tokenize(s)) >= 4]


def _ingredient_coverage(ingredients: list[str], generated_recipe: str) -> float:
    if not ingredients:
        return 0.0

    recipe_norm = " " + " ".join(_tokenize(generated_recipe)) + " "
    total = 0
    matched = 0

    for ingredient in ingredients:
        ing = " ".join(_tokenize(ingredient))
        if not ing:
            continue
        total += 1
        if f" {ing} " in recipe_norm:
            matched += 1

    if total == 0:
        return 0.0
    return 100.0 * (matched / total)


def _actionability_score(steps: list[str]) -> float:
    if not steps:
        return 0.0

    actionable = 0
    for step in steps:
        tokens = _tokenize(step)
        if tokens and tokens[0] in ACTION_VERBS:
            actionable += 1

    return 100.0 * (actionable / len(steps))


def _step_count_alignment(reference_steps: list[str], generated_steps: list[str]) -> float:
    if not reference_steps:
        return 0.0

    delta = abs(len(reference_steps) - len(generated_steps))
    rel_gap = delta / max(1, len(reference_steps))
    return max(0.0, 100.0 * (1.0 - rel_gap))


def evaluate_recipe_pair(generated_recipe: str, reference_recipe: str, ingredients: list[str] | None = None) -> dict[str, float]:
    ingredients = ingredients or []

    ref_text = _normalize_spaces(reference_recipe)
    gen_text = _normalize_spaces(generated_recipe)

    bleu = corpus_bleu([gen_text], [[ref_text]], lowercase=True).score
    chrf = corpus_chrf([gen_text], [[ref_text]]).score

    scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
    rouge_scores = scorer.score(ref_text, gen_text)
    rouge1_f = rouge_scores["rouge1"].fmeasure * 100.0
    rouge2_f = rouge_scores["rouge2"].fmeasure * 100.0
    rougeL_f = rouge_scores["rougeL"].fmeasure * 100.0

    ref_steps = _extract_steps(ref_text)
    gen_steps = _extract_steps(gen_text)
    step_alignment = _step_count_alignment(ref_steps, gen_steps)
    actionability = _actionability_score(gen_steps)

    ingredient_coverage = _ingredient_coverage(ingredients, gen_text)

    ref_title = _extract_title(ref_text)
    gen_title = _extract_title(gen_text)
    title_exact_match = 100.0 if ref_title and gen_title and ref_title == gen_title else 0.0

    overall_quality_score = (
        0.25 * bleu
        + 0.25 * rougeL_f
        + 0.10 * rouge2_f
        + 0.15 * chrf
        + 0.15 * ingredient_coverage
        + 0.10 * step_alignment
    )

    return {
        "bleu": float(bleu),
        "chrf": float(chrf),
        "rouge1_f": float(rouge1_f),
        "rouge2_f": float(rouge2_f),
        "rougeL_f": float(rougeL_f),
        "ingredient_coverage": float(ingredient_coverage),
        "step_count_alignment": float(step_alignment),
        "actionability": float(actionability),
        "title_exact_match": float(title_exact_match),
        "overall_quality_score": float(max(0.0, min(100.0, overall_quality_score))),
    }


def quality_verdict(score: float) -> str:
    if score >= 75.0:
        return "good"
    if score >= 55.0:
        return "acceptable"
    return "needs_improvement"


def evaluate_with_auto_reference(generated_recipe: str, ingredients: list[str] | None = None) -> dict[str, object]:
    ingredients = ingredients or []
    reference = find_best_reference_recipe(ingredients)
    if reference is None:
        return {
            "metrics": {},
            "verdict": "unavailable",
            "reference_name": "",
            "reference_recipe": "",
            "reference_ingredient_match": 0.0,
        }

    metrics = evaluate_recipe_pair(
        generated_recipe=generated_recipe,
        reference_recipe=str(reference["recipe_text"]),
        ingredients=ingredients,
    )
    return {
        "metrics": metrics,
        "verdict": quality_verdict(metrics["overall_quality_score"]),
        "reference_name": str(reference["name"]),
        "reference_recipe": str(reference["recipe_text"]),
        "reference_ingredient_match": float(reference["ingredient_match"]),
    }
