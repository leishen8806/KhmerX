// Adds one test loan (with contract data) for the most recently registered
// customer of the public workspace, so the app's read-only loan/contract
// screens have something to show. Test money only. Run AFTER registering in the app.
import { openDevDb, PUBLIC_COMPANY_ID } from './common.mjs';

const db = openDevDb();
const acc = db.prepare('SELECT customer_id FROM h5_accounts WHERE owner=? ORDER BY rowid DESC LIMIT 1').get(PUBLIC_COMPANY_ID);
if (!acc) { console.error('No registered customer yet. Register in the app first, then run this again.'); process.exit(1); }
const row = db.prepare('SELECT revision,payload FROM demo_workspaces WHERE owner=?').get(PUBLIC_COMPANY_ID);
if (!row) { console.error('Run seed.mjs first.'); process.exit(1); }
const state = JSON.parse(row.payload);
state.loans = state.loans.filter((l) => l.customerId !== acc.customer_id);
const now = new Date();
const signedAt = new Date(now.getTime() - 2 * 86400000).toISOString();
const dueAt = new Date(now.getTime() + 12 * 86400000).toISOString();
const id = 'dev-loan-' + Math.random().toString(16).slice(2, 10);
const billing = { quoteId: 'dev-quote', principal: 5000, deduction: 0, interest: 150, service: 50, upfront: 0, net: 5000, total: 5200, currency: 'USD', termDays: 14, version: 1 };
state.loans.unshift({
  id, customerId: acc.customer_id, name: 'TEST USER', botId: 'bot-1', amount: 5000, fee: 200, status: 'active',
  approvalActor: 'dev-seed-lender', approvalCheckedBy: 'dev-seed-checker', fundingActor: 'dev-seed-finance', fundingCheckedBy: 'dev-seed-finance-checker',
  createdAt: signedAt, paid: 0, wallet: 5000, note: 'Dev test loan (test funds only)', demoDays: 0, dueAt, billing, billConfirmedAt: signedAt,
  signedAt, signature: 'dev', contract: JSON.stringify({ loanId: id, principal: 5000, fee: 200, currency: 'USD', termDays: 14, signedAt, notice: 'Test funds only' }),
  kyc: { income: 0, contacts: [], document: '' },
});
db.prepare('UPDATE demo_workspaces SET payload=?,revision=revision+1 WHERE owner=?').run(JSON.stringify(state), PUBLIC_COMPANY_ID);
console.log('added test loan', id, 'for customer', acc.customer_id.slice(0, 6) + '…');
