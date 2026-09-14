import { NextResponse } from "next/server";

/**
 * Download proxy.
 *
 * Browsers ignore the `download` attribute on a cross-origin link, so a direct
 * link to Unsplash opens the picture in a tab instead of saving it. Streaming
 * it through our own origin with Content-Disposition makes "Download" actually
 * download.
 *
 * The host allow-list below is the security boundary: without it this endpoint
 * would fetch any URL a caller supplied, turning the server into an open proxy
 * into private networks. News CDNs are deliberately absent — news pictures are
 * not ours to redistribute.
 */
const ALLOWED_HOSTS = new Set([
  "images.unsplash.com",
  "images.pexels.com",
  "picsum.photos",
  "fastly.picsum.photos",
  "i.picsum.photos",
]);

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  const name = (searchParams.get("name") ?? "weji-wallpaper.jpg").replace(/[^\w.\-؀-ۿ]/g, "_");

  if (!src) {
    return NextResponse.json({ error: "missing_src" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: "invalid_src" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host_not_allowed" }, { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "WEJI/1.0 (+https://weji.app)" },
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "not_an_image" }, { status: 415 });
    }

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES) {
      return NextResponse.json({ error: "too_large" }, { status: 413 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
