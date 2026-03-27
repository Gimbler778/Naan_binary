from __future__ import annotations

import os
import re
from functools import lru_cache
from collections import OrderedDict

import joblib
import numpy as np
import torch
from torch import nn
from transformers import AutoTokenizer, T5ForConditionalGeneration


NUTRITION_COLS = [
    "Calories",
    "FatContent",
    "SaturatedFatContent",
    "CholesterolContent",
    "SodiumContent",
    "CarbohydrateContent",
    "FiberContent",
    "SugarContent",
    "ProteinContent",
]

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


class RegressionHead(nn.Module):
    def __init__(self, hidden_size: int, num_targets: int) -> None:
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, num_targets),
        )

    def forward(self, pooled: torch.Tensor) -> torch.Tensor:
        return self.layers(pooled)


class ModelService:
    def __init__(self) -> None:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.model_dir = os.path.join(base_dir, "assets", "model_final")
        self.base_tokenizer_id = "google/flan-t5-base"

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        # Some exported tokenizer configs can be incompatible across transformers versions.
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
        except Exception:
            self.tokenizer = AutoTokenizer.from_pretrained(self.base_tokenizer_id)
        self.model = T5ForConditionalGeneration.from_pretrained(self.model_dir).to(self.device)
        self.model.eval()

        hidden_size = self.model.config.d_model
        self.reg_head = RegressionHead(hidden_size=hidden_size, num_targets=len(NUTRITION_COLS)).to(self.device)
        reg_head_path = os.path.join(self.model_dir, "reg_head.pt")
        raw_state = torch.load(reg_head_path, map_location=self.device)
        try:
            self.reg_head.load_state_dict(raw_state)
        except RuntimeError:
            remapped_state = OrderedDict((f"layers.{k}", v) for k, v in raw_state.items())
            self.reg_head.load_state_dict(remapped_state)
        self.reg_head.eval()

        self.scaler = joblib.load(os.path.join(self.model_dir, "scaler.pkl"))
        self.log_target_cols = set(np.load(os.path.join(self.model_dir, "log_target_cols.npy"), allow_pickle=True).tolist())

    @staticmethod
    def normalize_ingredient(token: str) -> str:
        s = token.lower().strip()
        s = re.sub(r"\([^)]*\)", " ", s)
        s = re.sub(r"^\s*(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)\s*", "", s)
        s = re.sub(r"^\s*(?:x|about|approx\.?|approximately)\s+", "", s)
        parts = s.split()
        while parts and re.fullmatch(r"\d+(?:\.\d+)?", parts[0]):
            parts.pop(0)
        while parts and parts[0] in UNIT_WORDS:
            parts.pop(0)
        s = " ".join(parts)
        s = re.sub(r"[^a-zA-Z\s-]", " ", s)
        s = re.sub(r"\s+", " ", s).strip(" -")
        return s

    def build_input_prompt(self, ingredients: list[str], total_minutes: float) -> str:
        cleaned = [self.normalize_ingredient(x) for x in ingredients]
        cleaned = [x for x in cleaned if x]
        cleaned = list(dict.fromkeys(cleaned))[:40]
        prompt = f"ingredients: {', '.join(cleaned)}"
        if total_minutes > 0:
            prompt += f" | ready_in_min: {int(total_minutes)}"
        return prompt

    def inverse_targets(self, y_scaled: np.ndarray) -> np.ndarray:
        y_t = np.asarray(self.scaler.inverse_transform(y_scaled), dtype=np.float32)
        for i, col in enumerate(NUTRITION_COLS):
            if col in self.log_target_cols:
                y_t[:, i] = np.expm1(y_t[:, i])
        return np.clip(y_t, 0.0, None)

    @staticmethod
    def score_recipe_validity(text: str) -> float:
        text_norm = re.sub(r"\s+", " ", text).strip()
        if not text_norm:
            return 0.0

        score = 100.0
        body = re.sub(r"^.*?steps\s*:\s*", "", text_norm, flags=re.IGNORECASE)
        parts = [p.strip() for p in re.split(r"\s(?=\d+[\).]\s)", body) if p.strip()]
        steps = [re.sub(r"^\d+[\).]\s+", "", p).strip() for p in parts if re.match(r"^\d+[\).]\s+", p)]

        if len(steps) < 3:
            score -= 35
        if steps:
            short_steps = sum(1 for s in steps if len(s.split()) < 4)
            score -= min(20.0, short_steps * 5.0)
            first_words = [s.split()[0].lower() for s in steps if s.split()]
            verb_ratio = sum(1 for w in first_words if w in ACTION_VERBS) / max(1, len(steps))
            if verb_ratio < 0.3:
                score -= 12.0

        return max(0.0, min(100.0, score))

    @torch.no_grad()
    def predict(self, ingredients: list[str], total_minutes: float, servings: float, num_candidates: int, max_new_tokens: int) -> dict:
        input_text = self.build_input_prompt(ingredients, total_minutes)
        enc = self.tokenizer(input_text, return_tensors="pt", truncation=True, max_length=128)
        enc = {k: v.to(self.device) for k, v in enc.items()}

        generated = self.model.generate(
            input_ids=enc["input_ids"],
            attention_mask=enc["attention_mask"],
            max_new_tokens=max_new_tokens,
            num_beams=max(6, num_candidates),
            num_return_sequences=num_candidates,
            do_sample=False,
            no_repeat_ngram_size=3,
            repetition_penalty=1.15,
            length_penalty=0.95,
            early_stopping=True,
        )
        texts = self.tokenizer.batch_decode(generated, skip_special_tokens=True)

        candidates = [
            {"text": t, "score": float(self.score_recipe_validity(t))}
            for t in texts
        ]
        candidates.sort(key=lambda x: x["score"], reverse=True)
        best_recipe = candidates[0]["text"] if candidates else ""

        enc_hidden = self.model.encoder(
            input_ids=enc["input_ids"],
            attention_mask=enc["attention_mask"],
            return_dict=True,
        ).last_hidden_state
        mask = enc["attention_mask"].unsqueeze(-1).float()
        pooled = (enc_hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1.0)
        pred_scaled = self.reg_head(pooled).float().cpu().numpy()
        pred_nutrition = self.inverse_targets(pred_scaled)[0]

        serving_scale = max(servings, 1e-6) / 4.0
        pred_nutrition = pred_nutrition * serving_scale

        return {
            "input_text": input_text,
            "recipe_text": best_recipe,
            "nutrition": {k: float(v) for k, v in zip(NUTRITION_COLS, pred_nutrition)},
            "candidates": candidates,
        }


@lru_cache(maxsize=1)
def get_model_service() -> ModelService:
    return ModelService()
