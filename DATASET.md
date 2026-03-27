# Dataset Management

This repository is configured to keep the full dataset out of Git history.

## Why

`cleaned_recipes.csv` is large and can exceed practical GitHub limits for regular Git workflows.

## Current Rule

`.gitignore` excludes:

- `cleaned_recipes.csv`
- `data/`

## Recommended Workflow

- Keep the full CSV local in project root as `cleaned_recipes.csv`.
- Commit code, notebook logic, and documentation only.

## Optional: Share a Small Sample

Create a sample file for collaborators:

Windows PowerShell:

```powershell
Get-Content cleaned_recipes.csv -TotalCount 501 | Set-Content cleaned_recipes.sample.csv
```

This keeps header + first 500 rows.

## Optional: Use Git LFS

If you must version the full dataset in GitHub, use Git LFS:

```powershell
git lfs install
git lfs track "cleaned_recipes.csv"
git add .gitattributes cleaned_recipes.csv
git commit -m "Track dataset with Git LFS"
```

Use LFS only if your team/project plan supports it.
