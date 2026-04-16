import { useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const INITIAL_FORM = {
  ingredients: "chicken breast, garlic, lemon, olive oil, rosemary, salt, black pepper",
  total_minutes: 45,
  servings: 4,
  num_candidates: 4,
};

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const ingredientCount = useMemo(() => {
    return form.ingredients
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean).length;
  }, [form.ingredients]);

  const nutritionEntries = useMemo(() => {
    if (!result?.nutrition) {
      return [];
    }

    return Object.entries(result.nutrition).map(([label, value]) => ({
      label,
      value: Number(value),
    }));
  }, [result]);

  const candidateEntries = useMemo(() => {
    if (!result?.candidates) {
      return [];
    }

    return result.candidates.slice(0, 3);
  }, [result]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

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
    } catch (err) {
      const message = err?.response?.data?.detail || err.message || "Prediction failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRecipe = () => {
    if (!result?.recipe_text) {
      return;
    }

    downloadFile("recipe.txt", result.recipe_text, "text/plain;charset=utf-8");
  };

  const handleDownloadNutrition = () => {
    if (!nutritionEntries.length) {
      return;
    }

    const csv = [
      "Nutrient,Value",
      ...nutritionEntries.map(({ label, value }) => `${label},${value.toFixed(2)}`),
    ].join("\n");

    downloadFile("nutrition-values.csv", csv, "text/csv;charset=utf-8");
  };

  return (
    <div className="page">
      <div className="bg-shape bg-shape-a" />
      <div className="bg-shape bg-shape-b" />
      <div className="bg-grid" />

      <main className="layout">
        <section className="card input-card">
          <div className="hero-copy">
            <span className="eyebrow">Recipe generation + nutrition estimate</span>
            <h1>Naan Binary</h1>
            <p className="subtitle">
              Turn ingredients into a polished recipe draft and export the nutrition values in one flow.
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
              <span className="helper-text">Add comma-separated ingredients to generate the recipe.</span>
              <button type="submit" disabled={loading} className="primary-button">
                {loading ? "Generating..." : "Generate Recipe"}
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
                onClick={handleDownloadRecipe}
                disabled={!result?.recipe_text}
              >
                Download recipe
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleDownloadNutrition}
                disabled={!nutritionEntries.length}
              >
                Download nutrition values
              </button>
            </div>
          </div>

          {!result && <p className="placeholder">Your generated recipe will appear here.</p>}

          {result && (
            <>
              <div className="content-grid">
                <div className="recipe-block panel">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow eyebrow-muted">Recipe</span>
                      <h3>Generated draft</h3>
                    </div>
                  </div>
                  <pre>{result.recipe_text || "No recipe returned."}</pre>
                </div>

                <div className="nutrition-block panel">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow eyebrow-muted">Nutrition</span>
                      <h3>Per serving estimate</h3>
                    </div>
                  </div>
                  <div className="nutrition-grid">
                    {nutritionEntries.map(({ label, value }) => (
                      <div key={label} className="nutrition-item">
                        <span className="k">{label}</span>
                        <span className="v">{value.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cand-block panel panel-wide">
                  <div className="panel-header">
                    <div>
                      <span className="eyebrow eyebrow-muted">Candidates</span>
                      <h3>Top ranked outputs</h3>
                    </div>
                  </div>
                  <div className="candidate-list">
                    {candidateEntries.map((cand, idx) => (
                      <article key={`${idx}-${cand.score}`} className="candidate-card">
                        <div className="candidate-topline">
                          <span className="candidate-rank">#{idx + 1}</span>
                          <span className="candidate-score">{cand.score.toFixed(1)} / 100</span>
                        </div>
                        <p>{cand.text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
