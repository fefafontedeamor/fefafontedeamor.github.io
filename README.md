# Orações · Fraternidade Espírita Fonte de Amor

Static prayer site. Prayers come from a Google Sheet fed by a Google Form; only rows marked as approved are published.

## Configuration

Edit `config.js`:

- `csvUrl`: "Publish to web" CSV link of the approved-prayers tab (column A = title, column B = text, first row = headers).
- `formUrl`: the Google Form share link. Leave empty to hide the "Enviar uma oração" button.

## Adding / approving prayers

1. Someone submits the Google Form.
2. In the sheet, tick **Aprovado** on that row.
3. It appears on the site within ~5 minutes (Google caches the published CSV).

Fix typos directly in the sheet. Unticking removes a prayer from the site.

## Run locally

```sh
python -m http.server 8000
```

Open http://localhost:8000.

## Deploy (GitHub Pages)

1. Push this folder to a public GitHub repo.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The site is served at `https://<user>.github.io/<repo>/`.
