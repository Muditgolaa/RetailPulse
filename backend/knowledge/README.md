# NovaMart knowledge base (fictional)

These are **fictional demo policies** for the RetailPulse AI hackathon, not real retailer policies. The policy assistant answers only from these documents.

## Documents

| File | docId | Version | Effective | Category | Sections |
|---|---|---|---|---|---|
| `returns.md` | `returns-refunds-policy` | 2026.2 | 2026-04-01 | ALL | Return window, Eligibility, Non-returnable products, Damaged/defective/wrong items, Discounted items, How to return, Refund timelines, Cancellations |
| `electronics.md` | `opened-electronics-policy` | 2026.1 | 2026-03-01 | Electronics | Scope, Phones and tablets, Laptops, TVs, Headphones and wearables, Replacement before refund, Customer data |
| `delivery.md` | `shipping-delivery-policy` | 2026.3 | 2026-07-01 | ALL | Options, Where delivery is available, Timelines, Fees, Store pickup, Installation, Delayed orders |
| `membership.md` | `membership-benefits` | 2026.1 | 2026-01-01 | ALL | Tiers, one section per tier, Limits of extended returns, NovaPoints |
| `warranty.md` | `warranty-policy` | 2026.1 | 2026-02-01 | ALL | Periods by category, Claims, Exclusions, Failures within 7 days, NovaCare |
| `payments.md` | `payment-methods-policy` | 2026.1 | 2026-01-15 | ALL | Online methods, In-store methods, Cash on delivery, EMI, Split payments, Failed payments, Security |

All documents use `region: IN`. Bitcoin, cryptocurrency and pets are deliberately not mentioned anywhere, so those questions test the "not found" path.

## Rules for the ingestion step

- **Which files:** only ingest `*.md` files in this folder that have a `docId` in their front matter. This README and `eval/` are skipped.
- **Metadata:** the YAML front matter (`docId`, `title`, `docType`, `version`, `effectiveDate`, `region`, `tier`, `category`) is copied onto every chunk.
- **Sections:** split on `## ` headings first, so each chunk is one section. The heading becomes the chunk's `section`, which is shown in citations. Sections are short enough to be one chunk each.
- **Tier-specific sections:** a `<!-- tier: GOLD -->` comment under a heading overrides `tier` for that section's chunks. This only happens in `membership.md`. A Standard customer then never retrieves the Gold section.
- **Effective date:** filter with `effectiveDate <= today`.

## Golden questions

`eval/golden-questions.json` holds 10 questions. Each one lists:

- the tier to ask as
- whether an answer should be found
- the expected source sections
- the facts the answer must include
- statements it must not make

| # | Question | Ask as | Expected result |
|---|---|---|---|
| Q1 | Can I return an opened phone? | Gold | **Opened Electronics › Opened mobile phones and tablets.** Only if it is defective or not as described, within 7 days, and the defect must be confirmed. A change of mind is not accepted. The Gold 15-day window does not apply. |
| Q2 | How long do refunds take? | Standard | **Returns › Refund timelines.** Inspection within 2 business days. UPI and wallets take 1–3 business days, net banking 3–5, cards 5–7. Store credit within 2 hours is an option. |
| Q3 | Is express delivery free for Gold members? | Gold | **Membership › Gold member benefits** and **Delivery › Delivery fees.** Free on orders of ₹2,000 or more in Delhi NCR. Otherwise ₹149. |
| Q4 | What is the warranty period? | Standard | **Warranty › Warranty periods by product category.** It depends on the category: for example phones, laptops and TVs 1 year, small accessories 6 months, NovaTech products 2 years. |
| Q5 | Which payment methods are accepted? | Standard | **Payments › Accepted payment methods online / in stores.** UPI, cards (Visa, Mastercard, RuPay, Amex), net banking, gift cards, NovaPoints, and cash on delivery up to ₹50,000. |
| Q6 | Can I return a damaged product? | Standard | **Returns › Damaged, defective or wrong items.** Yes. Report within 48 hours with photos. NovaMart replaces the product, or refunds it if no replacement is in stock, with a free pickup. |
| Q7 | Does delivery eligibility vary by location? | Standard | **Delivery › Where delivery is available.** Yes, by pincode. Express delivery is only in Delhi NCR, large appliances only in NCR and the listed metros, and cash on delivery not everywhere. |
| Q8 | Are there different benefits for Gold members? | Gold | **Membership › Gold member benefits.** 3 points per ₹100, free standard delivery, free express delivery on orders of ₹2,000 or more in NCR, a 15-day return window, and priority support. |
| Q9 | Can I pay with Bitcoin? | Standard | **Not found.** `followUpRequired: true`. It may say Bitcoin is not among the listed methods, but must never say it is accepted. |
| Q10 | Can I bring my pet dog into a NovaMart store? | Standard | **Not found.** `followUpRequired: true`. It must not invent a pet policy. |

Report the result as "retrieval hit-rate x/10": a question counts as a hit when the expected section is among the retrieved sources, or when nothing is retrieved for Q9 and Q10.
