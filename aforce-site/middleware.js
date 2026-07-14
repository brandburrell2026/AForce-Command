/* =====================================================================
   Vercel Edge Middleware — hides the headless build pre-cutover.
   /shop-preview/* and /api/shop|cart/* return 404 unless SHOP_PREVIEW_ENABLED
   is set (to 1/true/on). Set it ONLY in Vercel preview deployments during the
   build; enable in production at cutover. Everything else is untouched.
   ===================================================================== */
export const config = {
  matcher: ["/shop-preview", "/shop-preview/:path*", "/api/shop/:path*", "/api/cart/:path*"]
};

export default function middleware() {
  const v = process.env.SHOP_PREVIEW_ENABLED;
  const enabled = v === "1" || v === "true" || v === "on";
  if (enabled) return; // continue → serve the route normally
  return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}
