// Adapter Cloudflare Pages untuk /api/transactions; aturan transaksi tetap berada di worker.js.
import api from "../../worker.js";

export async function onRequest(context) {
  return api.fetch(context.request, context.env, context);
}
