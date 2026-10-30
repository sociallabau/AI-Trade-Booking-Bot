# AI Trade Booking Bot

Replies to home-maintenance leads by SMS in GoHighLevel using Claude. It works out the problem (reads photos too), asks urgency and suburb, gets the day/time that suits, then hands over to the team to call.

**Setting it up? Open [START-HERE.md](START-HERE.md).**

## How it works
GHL workflow (Customer Replied) → `POST /api/ghl-reply` → bot fetches the whole conversation from GHL → Claude replies → reply sent via GHL. GHL is the memory; there is no database.

- `api/ghl-reply.ts` webhook and guards (secret, duplicate, tags, 20-message cap)
- `lib/prompt.ts` the bot's instructions and tone
- `lib/ai.ts` Claude call and tools (save note, hand off; optional calendar booking)
- `lib/ghl.ts` GHL API wrapper
- `test/run.ts` mocked end-to-end test (`npm install && npm test`)
