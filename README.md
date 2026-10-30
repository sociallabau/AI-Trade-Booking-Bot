# GHL Lead Bot

Lead replies by text → GoHighLevel workflow calls this webhook → Claude reads the whole conversation (and any photos) → reply goes back out as an SMS from GHL. It qualifies the problem, asks once for photos, asks urgency + suburb, then books a slot on your GHL calendar.

No database: GHL's conversation history is the memory, and the full thread is sent to Claude every time. That is what stops it doubling back.

## Model
Claude Sonnet (`claude-sonnet-5-5`) by default: follows the checklist, uses tools and reads photos. Set `AI_MODEL=claude-haiku-5-5` to cut cost further.

## Current ending: team calls the lead
With no `GHL_CALENDAR_ID`, the bot does not book. It collects problem, photos, urgency, suburb and the day/time that suits, saves them as a note on the contact, tags it `ai-handoff` and tells the lead the team will call. Set `GHL_CALENDAR_ID` later to switch on direct booking.

## Setup (about 20 minutes)

### 1. Get the keys
- **Anthropic**: console.anthropic.com > API Keys.
- **GHL token**: Settings > Private Integrations > create one with scopes: conversations, conversations/message (read+write), contacts (read+write), calendars, calendars/events (read+write). Copy the token.
- **GHL Location ID**: Settings > Business Profile (or the ID in the sub-account URL).
- **Calendar ID** (optional, for booking): Calendars > Calendar Settings > the calendar's ID. Without it the bot qualifies and then hands off for a callback.

### 2. Deploy to Vercel
```bash
cd /Users/dan/projects/ghl-lead-bot
npx vercel            # first deploy, accept defaults
```
Then in the Vercel project > Settings > Environment Variables, add everything from `.env.example` (make `WEBHOOK_SECRET` a long random string), and run `npx vercel --prod`. Your endpoint is `https://<project>.vercel.app/api/ghl-reply`.

### 3. GHL workflow
Automation > Workflows > new:
- **Trigger**: Customer Replied, channel SMS. Add a filter: contact is in your pipeline stage (the column that starts the AI), so existing customers aren't answered by the bot.
- **Action**: Webhook, POST, URL above. Header `x-webhook-secret` = your secret. Body: default (needs `contact_id`).
- **Wait for reply** is not needed; this single workflow fires on every reply.

### 4. Taking over / stopping
The bot stays silent on any contact tagged `ai-stop`, `ai-booked` or `ai-handoff`. Add `ai-stop` yourself whenever you want to jump into a chat. The bot adds `ai-handoff` for emergencies, angry leads and anything it can't do, and `ai-booked` after a booking. Set up a GHL notification on the `ai-handoff` tag so someone calls quickly.

### 5. Test
Text your own number into the pipeline stage, reply "my tap is leaking", and watch the contact's notes/tags in GHL. Vercel > Logs shows errors.

## Things to verify on first run
- GHL's free-slots and appointment endpoints vary slightly by account/calendar type; if booking errors, the lead is tagged `ai-handoff` with the error in a note.
- MMS photos: confirm photos show in the GHL conversation. The bot only looks at jpg/png/gif/webp links.
- A2P 10DLC / SMS registration must be approved for texts to deliver in your country.

## Files
- `api/ghl-reply.ts` webhook, guards (secret, duplicate, tags, 20-message cap)
- `lib/prompt.ts` the brain: checklist, tone, safety rules (edit this to tune behaviour)
- `lib/ai.ts` Claude call + tools (save notes, get slots, book, hand off)
- `lib/ghl.ts` GHL API wrapper
- `test/run.ts` mocked end-to-end test (`npm test`)
