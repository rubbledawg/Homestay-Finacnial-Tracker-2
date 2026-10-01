# Property Ledger accounting review

## Status — 1 October 2026

The existing GitHub repository was pulled before editing and was already current. All edits and the local preview use this project folder. The hosted site's access policy was explicitly restricted to the owner, with no other users or groups.

Accounting and UI changes are implemented in this working folder and submitted to the existing GitHub repository at the user's request. The hosted website has not been updated; its live financial records have not been migrated or replaced. The local preview remains available for review and editing.

## Findings

The previous calculation deducted all expenses from cash, including personally funded reimbursables. It also mixed funding with income, treated reimbursement rights as a settlement between partners using ownership percentages, and inflated some booking proceeds by adding partner discounts back to the payout.

The observed July example had beginning cash ₱11,695, income ₱3,400, business-paid expenses ₱15,095 and partner-paid expenses ₱24,220. The old ending cash was −₱24,220. Correct ending cash is ₱0, operating expenses are ₱39,315, loss is ₱35,915 and the business owes the funding partner ₱24,220 before any separately evidenced repayment.

## Rules used everywhere

| Transaction | Business cash | Profit / loss | Partner liability |
|---|---:|---:|---:|
| Business income | Increase | Income | None |
| Business-paid expense | Decrease | Expense | None |
| Partner-paid business expense | No movement | Expense | Increase for payer |
| Repayable partner advance | Increase | No effect | Increase for funder |
| Partner reimbursement | Decrease | No effect | Decrease for recipient |
| Capital contribution | Increase | No effect | None |

Cash and partner liabilities carry separately across months and years. Ownership percentages do not reduce the business's reimbursement obligation. Pending/cancelled bookings create no received cash; net payout takes precedence over estimates. New bookings start Pending Payout.

Monthly summaries, overview, ledger balances, partner balances, CSV and PDF/JPEG reports share the accounting functions. Server storage contains records rather than a separate financial calculation. Backup/restore preserves the optional accounting fields, receipts, record IDs and future years. An unused handler that could replace July transactions was removed.

## History and migration

Migration is additive: it retains amounts, IDs, dates, attachments and original classification evidence. Known partner names become stable partner references. Partner-funded expenses stop affecting cash. Historical funding remains outside revenue; repayable intent and a partner allocation require evidence. Unknown payers and ambiguous legacy settlement flags are flagged for review, with no invented payment or ownership-based allocation.

The local preview uses the 21 September backup, not the latest cloud ledger. That backup contains 11 reimbursable expenses and 4 historical funding entries for WAJ; the 11 expenses have legacy Settled flags. Those flags require actual reimbursement amount, recipient and payment date to be checked. The observed current cloud July view instead showed Pending flags, so the older snapshot must not overwrite the live records. Exact review counts for the latest cloud dataset will be available after the authorized deployment and migration.

Before a live migration, `0001_preserve_ledger_snapshots.sql` copies each existing ledger row verbatim into `ledger_snapshots`, keyed by owner/revision. The worker snapshots the previous revision before every save and rejects older clients attempting to remove accounting version 2. If preserving a revision fails, the save fails. The existing ledger table and receipt bucket remain intact.

New optional JSON fields include funding source, partner ID, funding intent, accounting version, legacy classification evidence and review state. Opening cash overrides and opening partner balances remain separate. No destructive schema change is required. Local preview saves also retain prior snapshots under ignored `.sites-runtime/`.

## Interface

The dark LEDGER / Private Cloud identity and property/month selectors remain. Improvements include a wider responsive workspace, readable sans-serif type, seven financial cards, a visible cash equation, independent partner totals, clear transaction types and Paid / Funded By selection, separate advance/reimbursement entry, review disclosures and larger editable table controls. Currency uses right alignment and tabular numbers. Mobile cards stack and wide ledgers scroll. Custom categories no longer steal focus or scroll the dashboard to the last row on opening.

## Validation and remaining work

All five requested accounting scenarios pass. Additional coverage checks historical ambiguity, migration idempotency, partner identity, capital contributions, discounted/pending payouts, genuine shortfall warnings, shared CSV/ledger totals, backup round trips, cross-year cash/debt carry-forward, owner access, receipt isolation, stale-save rejection and original-row snapshots. Type checking and production build succeed. Desktop and mobile previews were visually reviewed; the inspected browser reported no errors.

The user chose an update to the existing GitHub repository rather than a hosted-site deployment. If deployment is requested later, verify the live migration and its review list then. Review legacy funding intent, unknown payers and any actual reimbursements rather than assuming old Settled flags prove a cash payment. Adding invited users later also requires updating the app's owner-only API policy and deciding which property records they may access.
