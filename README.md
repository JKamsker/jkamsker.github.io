# `jkamsker.github.io`

Personal website and blog of Jonas Kamsker.

- Website: `https://jonas.kamsker.at/`
- GitHub Pages: `https://jkamsker.github.io/`

## Local development

This repo uses Jekyll. The easiest way to run it locally is via Docker:

```sh
docker compose -f docker-compose-dev.yml up --build
```

Then open `http://localhost:4000/` (auto-reload is enabled via Jekyll LiveReload).

Note: `docker-compose-dev.yml` bind-mounts the common edit paths for faster performance on Windows. If you add new top-level files or need to edit `assets/bower_components`, rebuild the image (or add an extra mount).

## Credits

This site is based on the `devlopr-jekyll` theme (MIT licensed). Template sources and attribution can be found in the git history and `LICENSE`.
