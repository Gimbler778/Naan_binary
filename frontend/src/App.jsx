import { useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const INITIAL_FORM = {
  ingredients: "chicken breast, garlic, lemon, olive oil, rosemary, salt, black pepper",
  total_minutes: 45,
  servings: 4,
  num_candidates: 4,
};

const METRIC_INFO = {
  overall_quality_score: {
    label: "Overall Quality",
    description: "Weighted combined score (0-100) using overlap, ingredient usage, and recipe-structure consistency.",
  },
  bleu: {
    label: "BLEU",
    description: "Exact n-gram overlap precision with the reference recipe; higher means wording is closer.",
  },
  rougeL_f: {
    label: "ROUGE-L (F1)",
    description: "Longest common sequence similarity; captures sentence-level alignment and ordering.",
  },
  rouge1_f: {
    label: "ROUGE-1 (F1)",
    description: "Unigram overlap F1; reflects shared key cooking terms and ingredients.",
  },
  rouge2_f: {
    label: "ROUGE-2 (F1)",
    description: "Bigram overlap F1; reflects phrase-level match and local fluency.",
  },
  chrf: {
    label: "chrF",
    description: "Character n-gram similarity; robust when wording differs slightly but meaning is close.",
  },
  ingredient_coverage: {
    label: "Ingredient Coverage",
    description: "Percent of input ingredients mentioned in the generated recipe.",
  },
  step_count_alignment: {
    label: "Step Count Alignment",
    description: "How close the generated step count is to the matched reference recipe.",
  },
  actionability: {
    label: "Actionability",
    description: "Percent of steps that start with a cooking action verb (mix, bake, boil, etc.).",
  },
  title_exact_match: {
    label: "Title Exact Match",
    description: "100 only if generated and reference titles match exactly; otherwise 0.",
  },
};

const METRIC_ORDER = [
  "overall_quality_score",
  "bleu",
  "rougeL_f",
  "rouge1_f",
  "rouge2_f",
  "chrf",
  "ingredient_coverage",
  "step_count_alignment",
  "actionability",
  "title_exact_match",
];

function parseRecipeText(rawText) {
  const text = (rawText || "").replace(/\r/g, "").trim();
  if (!text) {
    return { title: "Generated Recipe", steps: [] };
  }

  const titleMatch = text.match(/name\s*:\s*(.*?)(?=\n|steps\s*:|$)/i);
  const parsedTitle = (titleMatch?.[1] || "").trim();

  let body = text.replace(/^.*?steps\s*:\s*/is, "").trim();
  if (body === text) {
    body = text.replace(/^name\s*:.*$/im, "").trim();
  }

  let steps = body
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (steps.length <= 1) {
    steps = body
      .split(/\s(?=\d+[.)]\s)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  steps = steps
    .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const fallbackTitle =
    text
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || "Generated Recipe";

  return {
    title: parsedTitle || fallbackTitle.replace(/^name\s*:\s*/i, "").trim(),
    steps,
  };
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function formatNutritionLabel(label) {
  return String(label || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s*Content$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function App() {
  const [activePage, setActivePage] = useState("main");
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [evaluation, setEvaluation] = useState(null);

  const ingredientCount = useMemo(() => {
    return form.ingredients
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean).length;
  }, [form.ingredients]);

  const parsedRecipe = useMemo(() => parseRecipeText(result?.recipe_text), [result?.recipe_text]);
  const parsedReference = useMemo(() => parseRecipeText(evaluation?.reference_recipe), [evaluation?.reference_recipe]);

  const nutritionEntries = useMemo(() => {
    if (!result?.nutrition) {
      return [];
    }

    return Object.entries(result.nutrition).map(([label, value]) => ({
      label,
      displayLabel: formatNutritionLabel(label),
      value: Number(value),
    }));
  }, [result]);

  const candidateEntries = useMemo(() => {
    if (!result?.candidates) {
      return [];
    }

    return result.candidates.slice(1).map((cand, index) => ({
      ...cand,
      rank: index + 2,
      parsed: parseRecipeText(cand?.text),
    }));
  }, [result]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setEvalError("");
    setEvaluation(null);

    try {
      const ingredients = form.ingredients
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      if (!ingredients.length) {
        throw new Error("Please add at least one ingredient.");
      }

      const payload = {
        ingredients,
        total_minutes: Number(form.total_minutes) || 0,
        servings: Number(form.servings) || 4,
        num_candidates: Number(form.num_candidates) || 4,
      };

      const { data } = await axios.post(`${API_BASE}/api/predict`, payload, {
        timeout: 120000,
      });
      setResult(data);
      setActivePage("main");

      setEvalLoading(true);
      try {
        const evalPayload = {
          generated_recipe: data.recipe_text,
          ingredients,
        };
        const evalResponse = await axios.post(`${API_BASE}/api/evaluate-auto`, evalPayload, {
          timeout: 120000,
        });
        setEvaluation(evalResponse.data);
      } catch (evalReqError) {
        const message =
          evalReqError?.response?.data?.detail || evalReqError.message || "Automatic scoring failed";
        setEvalError(message);
      } finally {
        setEvalLoading(false);
      }
    } catch (err) {
      const message = err?.response?.data?.detail || err.message || "Prediction failed";
      setError(message);
      setResult(null);
      setEvalLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBundle = () => {
    if (!result?.recipe_text && !nutritionEntries.length) {
      return;
    }

    const recipeTitle = parsedRecipe.title || "Generated Recipe";
    const safeName = recipeTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "generated-recipe";

    const recipeSection = [
      `# ${recipeTitle}`,
      "",
      ...(parsedRecipe.steps.length > 0
        ? parsedRecipe.steps.map((step, index) => `${index + 1}. ${step}`)
        : [result?.recipe_text || "No recipe returned."]),
    ];

    const nutritionSection = [
      "",
      "## Nutrition (Per Serving)",
      "",
      ...(nutritionEntries.length > 0
        ? [
            "| Nutrient | Value |",
            "| --- | ---: |",
            ...nutritionEntries.map(({ displayLabel, value }) => `| ${displayLabel} | ${value.toFixed(2)} |`),
          ]
        : ["_No nutrition values available._"]),
    ];

    const content = [...recipeSection, ...nutritionSection].join("\n");
    downloadFile(`${safeName}-recipe-and-nutrition.md`, content, "text/markdown;charset=utf-8");
  };

  return (
    <div className="page">
      <div className="bg-shape bg-shape-a" />
      <div className="bg-shape bg-shape-b" />
      <div className="bg-grid" />

      {activePage === "main" ? (
        <main className="layout">
          <section className="card input-card">
            <div className="hero-copy">
              <span className="eyebrow">Recipe generation + nutrition + quality score</span>
              <h1>Naan Recipe Studio</h1>
              <p className="subtitle">
                Turn ingredients into a polished recipe draft, export nutrition values, and review automatic quality scoring.
              </p>
            </div>

            <div className="stats-row" aria-label="Input summary">
              <div className="stat-pill">
                <span className="stat-value">{ingredientCount}</span>
                <span className="stat-label">ingredients</span>
              </div>
              <div className="stat-pill">
                <span className="stat-value">{form.total_minutes || 0}</span>
                <span className="stat-label">minutes</span>
              </div>
              <div className="stat-pill">
                <span className="stat-value">{form.servings || 4}</span>
                <span className="stat-label">servings</span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="form">
              <label>
                Ingredients (comma separated)
                <textarea
                  rows={5}
                  value={form.ingredients}
                  onChange={(e) => onChange("ingredients", e.target.value)}
                  placeholder="e.g. flour, yeast, yogurt, salt, olive oil"
                />
              </label>

              <div className="inline-grid">
                <label>
                  Total Minutes
                  <input
                    type="number"
                    min="0"
                    value={form.total_minutes}
                    onChange={(e) => onChange("total_minutes", e.target.value)}
                  />
                </label>

                <label>
                  Servings
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={form.servings}
                    onChange={(e) => onChange("servings", e.target.value)}
                  />
                </label>

                <label>
                  Candidates
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={form.num_candidates}
                    onChange={(e) => onChange("num_candidates", e.target.value)}
                  />
                </label>
              </div>

              <div className="meta-row">
                <span className="helper-text">{ingredientCount} ingredients detected</span>
                <button type="submit" disabled={loading || evalLoading} className="primary-button">
                  {loading ? "Generating..." : evalLoading ? "Scoring..." : "Generate Recipe"}
                </button>
              </div>
            </form>

            {error ? <p className="error">{error}</p> : null}
          </section>

          <section className="card output-card">
            <div className="section-header">
              <div>
                <span className="eyebrow eyebrow-muted">Output</span>
                <h2>Recipe and nutrition</h2>
              </div>
              <div className="result-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActivePage("candidates")}
                  disabled={!candidateEntries.length}
                >
                  View candidates page
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDownloadBundle}
                  disabled={!result?.recipe_text && !nutritionEntries.length}
                >
                  Download recipe + nutrition
                </button>
              </div>
            </div>

            {!result && <p className="placeholder">Your generated recipe, nutrition, and quality scores will appear here.</p>}

            {result ? (
              <div className="content-grid">
                <div className="recipe-block panel">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow eyebrow-muted">Recipe</span>
                      <h3>Generated draft</h3>
                    </div>
                  </div>

                  <article className="recipe-page">
                    <h4 className="recipe-title">{parsedRecipe.title || "Generated Recipe"}</h4>

                    {parsedRecipe.steps.length > 0 ? (
                      <ol className="recipe-steps">
                        {parsedRecipe.steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="recipe-fallback">{result.recipe_text || "No recipe returned."}</p>
                    )}
                  </article>
                </div>

                <div className="nutrition-block panel">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow eyebrow-muted">Nutrition</span>
                      <h3>Per serving estimate</h3>
                    </div>
                  </div>
                  <table className="nutrition-table" aria-label="Nutrition values per serving">
                    <tbody>
                      {nutritionEntries.map(({ label, displayLabel, value }) => (
                        <tr key={label}>
                          <th scope="row">{displayLabel}</th>
                          <td>{value.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          <section className="card eval-card">
            <h2>Automatic Quality Evaluation</h2>
            <p className="helper-text">
              This block directly scores the generated recipe against the closest ingredient-matched dataset reference.
            </p>

            {!result ? <p className="placeholder">Generate a recipe to see automatic evaluation.</p> : null}
            {evalLoading ? <p className="helper-text">Scoring in progress...</p> : null}
            {evalError ? <p className="error">{evalError}</p> : null}

            {evaluation?.verdict ? (
              <div className="evaluation-actions">
                <span className={`verdict-badge verdict-${evaluation.verdict}`}>{evaluation.verdict}</span>
                <span className="match-pill">
                  Reference ingredient match: {Number(evaluation.reference_ingredient_match || 0).toFixed(1)}%
                </span>
              </div>
            ) : null}

            {evaluation?.reference_name ? (
              <div className="reference-block">
                <h4>Matched Reference: {evaluation.reference_name}</h4>
                {parsedReference.steps.length > 0 ? (
                  <ol className="reference-steps">
                    {parsedReference.steps.slice(0, 5).map((step, idx) => (
                      <li key={`ref-${idx}`}>{step}</li>
                    ))}
                  </ol>
                ) : null}
              </div>
            ) : null}

            {evaluation?.metrics ? (
              <div className="metrics-grid">
                {METRIC_ORDER
                  .filter((key) => Object.prototype.hasOwnProperty.call(evaluation.metrics, key))
                  .map((key) => (
                    <div key={key} className="metric-item">
                      <span className="k">{METRIC_INFO[key]?.label || key}</span>
                      <span className="v">{Number(evaluation.metrics[key]).toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            ) : null}

            <div className="score-info-box">
              <h3>What These Scores Mean</h3>
              <p className="helper-text">All metrics are on a 0-100 scale. Higher is better.</p>
              <div className="score-info-list">
                {METRIC_ORDER.map((key) => (
                  <details key={`info-${key}`} className="score-info-item">
                    <summary>{METRIC_INFO[key]?.label || key}</summary>
                    <p>{METRIC_INFO[key]?.description || ""}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="layout layout-single">
          <section className="card candidates-page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow eyebrow-muted">Candidates</span>
                <h2>Alternative ranked recipes</h2>
              </div>
              <div className="result-actions">
                <button type="button" className="secondary-button" onClick={() => setActivePage("main")}>
                  Back to main page
                </button>
              </div>
            </div>

            {!candidateEntries.length ? (
              <p className="placeholder">Generate a recipe to view candidate alternatives.</p>
            ) : (
              <div className="candidate-list">
                {candidateEntries.map((cand, idx) => (
                  <article key={`${idx}-${cand.score}`} className="candidate-card">
                    <div className="candidate-topline">
                      <span className="candidate-rank">#{cand.rank}</span>
                      <span className="candidate-score">{Number(cand.score || 0).toFixed(1)} / 100</span>
                    </div>
                    <h4 className="candidate-title">{cand.parsed.title || `Candidate #${cand.rank}`}</h4>
                    {cand.parsed.steps.length > 0 ? (
                      <ol className="candidate-steps">
                        {cand.parsed.steps.map((step, stepIdx) => (
                          <li key={`${cand.rank}-${stepIdx}`}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="candidate-fallback">{cand.text || "No candidate text returned."}</p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
