import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const escapeHtml = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID");
  if (!key || !url) return json({ error: "backend_not_configured" }, 503);
  const sharedSecret = Deno.env.get("HAMIYA_WORKER_SECRET");
  const validShared = !!sharedSecret && sharedSecret.length >= 32 && req.headers.get("x-hamiya-worker-secret") === sharedSecret;
  if (req.headers.get("authorization") !== "Bearer " + key && !validShared) return json({ error: "unauthorized" }, 401);
  if (!token || !chatId) return json({ error: "telegram_secrets_missing" }, 503);
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: jobs, error } = await db.from("hamiya_notification_deliveries").select("notification_id,attempts").eq("channel", "telegram").in("state", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString()).order("next_attempt_at").limit(10);
  if (error) return json({ error: "queue_unavailable" }, 500);
  const { data: preferences } = await db.from("hamiya_telegram_preferences").select("event_type,enabled");
  const enabled = new Map((preferences || []).map((p: {event_type:string;enabled:boolean}) => [p.event_type,p.enabled]));
  let delivered = 0, failed = 0, skipped = 0;
  for (const job of jobs || []) {
    const { data: event } = await db.from("hamiya_admin_notifications").select("order_id,event_type,subject,details").eq("id",job.notification_id).maybeSingle();
    if (!event) continue;
    if (enabled.get(event.event_type) === false) {
      await db.from("hamiya_notification_deliveries").update({state:"delivered",last_error:"Skipped: administrator disabled this alert",delivered_at:new Date().toISOString()}).eq("notification_id",job.notification_id).eq("channel","telegram");
      skipped++;
      continue;
    }
    const details = event.details || {};
    let message = "🔔 <b>HAMIYA — " + escapeHtml(event.subject || event.event_type.replaceAll("_"," ").toUpperCase()) + "</b>";
    if (event.event_type === "order_submitted" && event.order_id) {
      const { data: order, error: orderError } = await db.from("hamiya_orders")
        .select("id,customer_id,status,items,total_cents,delivery_fee_cents,fulfilment,payment_status,created_at")
        .eq("id",event.order_id).maybeSingle();
      if (orderError || !order) continue;
      const { data: customer } = await db.from("hamiya_profiles")
        .select("profile,customer_id").eq("id",order.customer_id).maybeSingle();
      const profile = customer?.profile || {};
      const company = String(profile.business_name || "").trim();
      const buyer = String(profile.full_name || "").trim();
      const phone = String(profile.phone || "").trim();
      const items = Array.isArray(order.items) ? order.items : [];
      const money = (cents: unknown) => (Number(cents || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ETB";
      const lines = items.slice(0, 15).map((item: Record<string,unknown>, index: number) => {
        const qty = Number(item.quantity || item.cartons || 0);
        const unitPrice = Number(item.price_cents || 0);
        return (index + 1) + ". <b>" + escapeHtml(item.name || item.product_name || item.product_id || "Product") + "</b>" +
          (item.variant ? " · " + escapeHtml(item.variant) : "") +
          "\n   " + escapeHtml(qty || "?") + " cartons" +
          (unitPrice > 0 ? " × " + money(unitPrice) : "") +
          (unitPrice > 0 && qty > 0 ? "\n   Line total: <b>" + money(unitPrice * qty) + "</b>" : "");
      });
      const orderedAt = new Date(order.created_at).toLocaleString("en-GB", { timeZone: "Africa/Addis_Ababa", day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
      const companyName = company || "Not provided";
      const header = [
        "🏢 <b>HAMIYA INVESTMENT GROUP</b>",
        "━━━━━━━━━━━━━━━━━━",
        "🛒 <b>NEW CUSTOMER PURCHASE ORDER</b>",
        "",
        "📋 <b>ORDER DETAILS</b>",
        "Order ID: <code>#" + escapeHtml(order.id.slice(0, 8).toUpperCase()) + "</code>",
        "Received: " + escapeHtml(orderedAt) + " (EAT)",
        "",
        "🏬 <b>CUSTOMER / BUSINESS</b>",
        "Company: <b>" + escapeHtml(companyName) + "</b>",
        ...(buyer ? ["Contact: " + escapeHtml(buyer)] : []),
        ...(phone ? ["Phone: " + escapeHtml(phone)] : []),
        "",
        "📦 <b>PRODUCTS ORDERED</b>",
        ...(lines.length ? lines : ["View items in the dashboard"]),
        ...(items.length > 15 ? ["… and " + (items.length - 15) + " more items"] : []),
        "",
        "━━━━━━━━━━━━━━━━━━",
        "💰 <b>ORDER SUMMARY</b>",
        "Order total: <b>" + money(order.total_cents) + "</b>",
        "Fulfilment: " + escapeHtml(order.fulfilment || "Not specified"),
        "Payment: <b>" + escapeHtml(order.payment_status || "Awaiting verification") + "</b>",
        "Order status: <b>" + escapeHtml(order.status).toUpperCase() + "</b>",
        "━━━━━━━━━━━━━━━━━━",
        "",
        "🔎 <b>Next action:</b> Review the customer and confirm this order in the HAMIYA administrator dashboard.",
        "⚠️ Order submitted does not mean payment has been verified."
      ];
      message = header.join("\n");
    } else if (event.event_type === "customer_verification") {
      message += "\\n👤 New customer application awaiting review.\\nStatus: "+escapeHtml(details.status || "submitted");
    } else if (event.event_type === "low_inventory") {
      message += "\\n📦 Product: "+escapeHtml(details.product)+"\\nAvailable: "+escapeHtml(details.available)+"\\nThreshold: "+escapeHtml(details.threshold);
    } else if (event.event_type === "payment_evidence") {
      message += "\\n💳 Payment evidence submitted. Review independently before confirming funds.";
    } else if (event.event_type === "critical_system") {
      message += "\\n⚠️ Critical operational event. Check administrator audit logs.";
    }
    try {
      const response = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: event.event_type === "order_submitted" ? { inline_keyboard: [[{ text: "📋 Review order in HAMIYA Admin", url: "https://hamiyainvestmentgroup.vercel.app/#admin/orders" }]] } : undefined }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error("Telegram HTTP " + response.status + ": " + String(result.description || "delivery failed").slice(0, 160));
      await db.from("hamiya_notification_deliveries").update({ state: "delivered", attempts: job.attempts + 1, delivered_at: new Date().toISOString(), last_error: null }).eq("notification_id", job.notification_id).eq("channel", "telegram").neq("state", "delivered");
      delivered++;
    } catch (err) {
      const attempts = job.attempts + 1;
      await db.from("hamiya_notification_deliveries").update({ state: "failed", attempts, last_error: String(err).slice(0, 250), next_attempt_at: new Date(Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(attempts, 6))).toISOString() }).eq("notification_id", job.notification_id).eq("channel", "telegram").neq("state", "delivered");
      failed++;
    }
  }
  return json({ processed: (jobs || []).length, delivered, failed, skipped });
});