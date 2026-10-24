// Checks the seeded database with real SQL queries. Exits with code 1 if any check fails.
// Run with `npm run db:verify`.
import { prisma } from "../src/db.js";

let failures = 0;
function check(name: string, ok: boolean, detail: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function main() {
  // 1. Record counts
  const [counts] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT (SELECT count(*) FROM stores)       AS stores,
           (SELECT count(*) FROM products)     AS products,
           (SELECT count(*) FROM inventory)    AS inventory,
           (SELECT count(*) FROM sales_daily)  AS sales,
           (SELECT count(*) FROM users)        AS users,
           (SELECT count(*) FROM carts)        AS carts,
           (SELECT count(*) FROM cart_items)   AS cart_items,
           (SELECT count(*) FROM orders)       AS orders,
           (SELECT count(*) FROM order_items)  AS order_items`;
  const c = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)]));
  console.log("Counts:", c);
  check("4 stores", c.stores === 4, c.stores);
  check("50 products", c.products === 50, c.products);
  check("inventory at every store (50 x 4)", c.inventory === 200, c.inventory);
  check("3 users, 4 orders, 2 carts", c.users === 3 && c.orders === 4 && c.carts === 2, c);

  const storeCodes = await prisma.$queryRaw<{ code: string }[]>`SELECT code FROM stores`;
  check("store codes", sameSet(storeCodes.map((s) => s.code), ["DEL01", "GGN01", "NOIDA01", "FAR01"]), storeCodes.map((s) => s.code));

  const categories = await prisma.$queryRaw<{ category: string; n: bigint }[]>`
    SELECT category, count(*) AS n FROM products GROUP BY category ORDER BY category`;
  check("5 categories x 10 products", categories.length === 5 && categories.every((r) => Number(r.n) === 10),
    categories.map((r) => `${r.category}=${r.n}`).join(", "));

  // 2. Users and passwords
  const users = await prisma.$queryRaw<{ email: string; role: string; membershipTier: string; hashed: boolean }[]>`
    SELECT email, role::text AS role, "membershipTier"::text AS "membershipTier",
           ("passwordHash" LIKE '$2_$10$%' AND length("passwordHash") = 60) AS hashed
    FROM users ORDER BY id`;
  check("customer + manager accounts", users.filter((u) => u.role === "CUSTOMER").length === 2 && users.some((u) => u.role === "MANAGER"),
    users.map((u) => `${u.email} ${u.role} ${u.membershipTier}`).join(", "));
  check("all passwords are bcrypt hashes", users.every((u) => u.hashed), users.map((u) => u.hashed));

  // 3. Sales history
  const [sales] = await prisma.$queryRaw<{ days: bigint; first: Date; last: Date }[]>`
    SELECT count(DISTINCT "saleDate") AS days, min("saleDate") AS first, max("saleDate") AS last FROM sales_daily`;
  const yesterday = new Date(new Date().toISOString().slice(0, 10));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  check("14 days of sales ending yesterday", Number(sales.days) === 14 && sales.last.getTime() === yesterday.getTime(),
    `${sales.first.toISOString().slice(0, 10)} → ${sales.last.toISOString().slice(0, 10)} (${sales.days} days)`);

  // 4. Four low-stock products at DEL01 (available + incoming <= reorder point)
  const low = await prisma.$queryRaw<{ sku: string; available: number; reorderPoint: number; leadTimeDays: number; avgDaily: number }[]>`
    SELECT p.sku, (i."onHand" - i.reserved) AS available, i."reorderPoint", i."leadTimeDays",
           round(coalesce(sum(s.qty), 0)::numeric / 14, 2)::float AS "avgDaily"
    FROM inventory i
    JOIN stores st ON st.id = i."storeId" AND st.code = 'DEL01'
    JOIN products p ON p.id = i."productId"
    LEFT JOIN sales_daily s ON s."storeId" = i."storeId" AND s."productId" = i."productId"
    WHERE i."onHand" - i.reserved + i."incomingQty" <= i."reorderPoint"
    GROUP BY p.sku, i."onHand", i.reserved, i."reorderPoint", i."leadTimeDays"
    ORDER BY p.sku`;
  check("exactly 4 low-stock products at DEL01", sameSet(low.map((r) => r.sku), ["P205", "P302", "P405", "P503"]), low.map((r) => r.sku));
  for (const r of low) {
    const daysLeft = r.avgDaily ? r.available / r.avgDaily : Infinity;
    console.log(`      ${r.sku}: available ${r.available}, reorder point ${r.reorderPoint}, ${r.avgDaily}/day, ` +
      `${daysLeft.toFixed(1)} days left, lead ${r.leadTimeDays} → ${daysLeft < r.leadTimeDays ? "CRITICAL" : "LOW"}`);
  }

  // 5. Three suitable laptops under ₹80,000 (16 GB RAM)
  const laptops = await prisma.$queryRaw<{ sku: string; name: string; price: string }[]>`
    SELECT sku, name, price::text FROM products
    WHERE category = 'Laptops' AND price < 80000 AND specs->>'ram' LIKE '16 GB%' ORDER BY sku`;
  check("3 laptops under ₹80,000 with 16 GB RAM", laptops.length === 3, laptops.map((l) => `${l.sku} ${l.name} ₹${l.price}`).join(", "));

  // 6. One laptop out of stock at DEL01 but available at GGN01
  const p101 = await prisma.$queryRaw<{ code: string; available: number; incomingQty: number }[]>`
    SELECT st.code, (i."onHand" - i.reserved) AS available, i."incomingQty"
    FROM inventory i JOIN stores st ON st.id = i."storeId" JOIN products p ON p.id = i."productId"
    WHERE p.sku = 'P101' ORDER BY st.code`;
  const at = (code: string) => p101.find((r) => r.code === code)?.available;
  check("P101 unavailable at DEL01, available at GGN01", at("DEL01") === 0 && (at("GGN01") ?? 0) > 0, p101);

  const oosLaptopsAtDel = await prisma.$queryRaw<{ sku: string }[]>`
    SELECT p.sku FROM inventory i JOIN stores st ON st.id = i."storeId" JOIN products p ON p.id = i."productId"
    WHERE st.code = 'DEL01' AND p.category = 'Laptops' AND i."onHand" - i.reserved = 0`;
  check("only one laptop out of stock at DEL01", oosLaptopsAtDel.length === 1, oosLaptopsAtDel.map((r) => r.sku));

  // 7. Orders, including the delayed one
  const orders = await prisma.$queryRaw<{ code: string; status: string; total: string; email: string; overdue: boolean }[]>`
    SELECT o.code, o.status::text AS status, o.total::text AS total, u.email,
           (o."expectedDeliveryAt" < now()) AS overdue
    FROM orders o JOIN users u ON u.id = o."userId" ORDER BY o.code`;
  const delayed = orders.find((o) => o.code === "ORD-1023");
  check("ORD-1023 is DELAYED and past its expected date", delayed?.status === "DELAYED" && delayed.overdue === true, delayed);
  console.log("      " + orders.map((o) => `${o.code} ${o.status} ₹${o.total} (${o.email})`).join("\n      "));

  // 8. Reservations match open orders
  const [reserved] = await prisma.$queryRaw<{ reserved: bigint; open: bigint }[]>`
    SELECT (SELECT coalesce(sum(reserved), 0) FROM inventory) AS reserved,
           (SELECT coalesce(sum(oi.qty), 0) FROM order_items oi JOIN orders o ON o.id = oi."orderId"
             WHERE o.status IN ('PLACED', 'READY_FOR_PICKUP')) AS open`;
  check("reserved stock equals open order quantities", reserved.reserved === reserved.open, { reserved: Number(reserved.reserved), openOrderQty: Number(reserved.open) });
}

try {
  await main();
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
} catch (err) {
  console.error("Verify failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
