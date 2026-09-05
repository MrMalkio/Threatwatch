# Threatwatch public website

This directory contains the static public website for Threatwatch.

## Structure

- `index.html` product homepage
- `help/` help center and guides
- `faq/` frequently asked questions
- `safety/` public safety model
- `changelog/` public release history
- `legal/` privacy, terms, and acceptable use
- `assets/` shared CSS and JavaScript

The site intentionally has no build step, analytics package, remote JavaScript, external font, account code, or tracking pixel.

## Local preview

From the repository root:

```bash
python -m http.server 8080 --directory website
```

Then open `http://localhost:8080`.

## GitHub Pages

The repository includes `.github/workflows/pages.yml`. In GitHub repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions**. The workflow uploads only this `website/` directory.

GitHub Pages must be enabled in repository settings before the first deployment can succeed.

## Legal maintenance

The public policies describe the current 0.4.0 product and clearly mark server-backed community features as future functionality. Update the privacy policy before any new collection or transmission begins. Review `docs/LEGAL_REVIEW_CHECKLIST.md` before a paid or account-based launch.
