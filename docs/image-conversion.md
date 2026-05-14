# Image Conversion

Use optimized WebP images for blog thumbnails and other web-facing raster assets.

## Defaults

- Format: WebP
- Encoding: lossy
- Quality: 70
- Target size: under 200 KB
- Blog post image max dimensions: 1600x1600

These defaults keep images small enough for fast page loads while preserving enough quality for thumbnails and post previews.

## Convert One Image

Install Pillow if it is not already available:

```powershell
python -m pip install pillow
```

Convert a source image to WebP at quality 70:

```powershell
python -c "from PIL import Image, ImageOps; from pathlib import Path; src=Path(r'C:\path\to\source.png'); dst=Path(r'assets\img\posts\example.webp'); im=ImageOps.exif_transpose(Image.open(src)).convert('RGB'); im.thumbnail((1600,1600), Image.Resampling.LANCZOS); dst.parent.mkdir(parents=True, exist_ok=True); im.save(dst, format='WEBP', method=6, quality=70); print(f'{dst}: {dst.stat().st_size} bytes')"
```

After conversion, confirm the output is below 200 KB:

```powershell
Get-Item -LiteralPath 'assets\img\posts\example.webp' | Select-Object FullName,Length
```

If the image is still over 200 KB, keep quality at 70 and reduce the maximum dimensions until the file is below the target. For thumbnails, try 1400x1400, then 1200x1200.

## Update Post Front Matter

Reference the converted image from the post front matter:

```yaml
thumbnail: /assets/img/posts/example.webp
```

## Verify The Site

Run the Jekyll build through Docker:

```powershell
docker compose -f docker-compose-dev.yml run --rm jekyll bundle exec jekyll build --config _config.yml,_config.dev.yml --destination /tmp/jekyll-build-check
```
