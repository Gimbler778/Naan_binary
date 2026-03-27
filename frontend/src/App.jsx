import { useMemo, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const INITIAL_FORM = {
  ingredients: "chicken breast, garlic, lemon, olive oil, rosemary, salt, black pepper",
  total_minutes: 45,
  servings: 4,
  num_candidates: 4,
};

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

  return (
    <div className="page">
      <div className="bg-shape bg-shape-a" />
      <div className="bg-shape bg-shape-b" />

      <main className="layout">
        <section className="card input-card">
          <h1>Naan Recipe Studio</h1>
          <p className="subtitle">Generate a recipe and nutrition prediction from your ingredients.</p>

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
              <span>{ingredientCount} ingredients detected</span>
              <button type="submit" disabled={loading}>
                {loading ? "Generating..." : "Generate Recipe"}
              </button>
            </div>
          </form>

          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="card output-card">
          <h2>Result</h2>

          {!result && <p className="placeholder">Your generated recipe will appear here.</p>}

          {result && (
            <>
              <div className="recipe-block">
                <h3>Recipe</h3>
                <pre>{result.recipe_text || "No recipe returned."}</pre>
              </div>

              <div className="nutrition-block">
                <h3>Nutrition (per serving)</h3>
                <div className="nutrition-grid">
                  {Object.entries(result.nutrition || {}).map(([key, value]) => (
                    <div key={key} className="nutrition-item">
                      <span className="k">{key}</span>
                      <span className="v">{Number(value).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="cand-block">
                <h3>Top Candidates</h3>
                <ul>
                  {(result.candidates || []).slice(0, 3).map((cand, idx) => (
                    <li key={`${idx}-${cand.score}`}>
                      <strong>#{idx + 1}</strong> score: {cand.score.toFixed(1)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
