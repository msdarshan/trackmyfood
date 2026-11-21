# TrackMyFood

A dark-themed PWA for tracking Indian meals, macros and micronutrients. You can log by photo, and everything syncs to Google Sheets.

## Files
| File | What it is |
|---|---|
| `index.html` | The whole app (UI and logic) |
| `foods.js` | Built-in database of 165 Indian foods, with values per 100 g and household units |
| `Code.gs` | Google Apps Script backend: Sheets storage plus a Claude proxy |
| `sw.js`, `manifest.json`, `icon-*.png` | Let you install it and use it offline |

## 1. Google Sheet + Apps Script (about 5 min)
1. Create a new Google Sheet, for example "TrackMyFood".
2. Go to **Extensions → Apps Script**, delete the sample code and paste in all of `Code.gs`. Save.
3. Choose `setup` in the function dropdown and click **Run**. Grant the permissions it asks for.
   This creates the tabs `Log`, `Daily`, `MyMeals`, `Recurring`, `CustomFoods` and `Settings`.
   Open **Execution log** and copy the `APP_TOKEN = …` value.
4. Go to **Project Settings (gear) → Script properties → Add property**:
   `GEMINI_API_KEY` = a free key from https://aistudio.google.com/apikey
   (Optional: `ANTHROPIC_API_KEY` is used instead if no Gemini key is set. Claude API needs prepaid Console credits.)
5. Go to **Deploy → New deployment → type: Web app**.
   Execute as **Me**, who has access **Anyone**. Deploy and copy the `/exec` URL.
   (A request without the token is rejected, so "Anyone" does not mean anyone can read your data.)
6. If you edit `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## 2. Host the app (free, HTTPS)
The camera input and home-screen install need HTTPS. With GitHub Pages:
1. Create a new public repo, e.g. `trackmyfood`, and upload every file in this folder **except `Code.gs`**.
2. Go to **Settings → Pages → Deploy from branch → main / root**.
3. Open `https://<you>.github.io/trackmyfood/` in **Safari** on your iPhone, then **Share → Add to Home Screen**.

Netlify Drop (drag the folder onto app.netlify.com/drop) also works.

## 3. Connect
In the app, go to **Settings** and fill in:
- **Apps Script Web App URL**: the `/exec` URL
- **Token**: the APP_TOKEN
- Tap **Test connection**

## How it works
- **Meals**: Breakfast, Morning snack, Lunch, Evening snack, Dinner. Each shows kcal and P/C/F, and the ⋯ menu shows every nutrient.
- **Nutrients tracked**: kcal, protein, carbs, fat, fibre, sugar, saturated fat, sodium, potassium, calcium, iron, vitamin C and vitamin A. They are compared with targets you can edit (defaults follow ICMR-NIN guidance for adults).
- **Photo**: Snap or Upload. The photo is resized to 1280 px and sent through Apps Script to Google Gemini (free tier), which names each item and estimates quantity (pieces, katori, grams). Items that match the built-in database use its values; anything else uses Claude's estimate and is marked "AI estimate". Low-confidence items are marked "check". Note: on Gemini's free tier, Google may use prompts and photos to improve its products. You review and edit everything before it's logged. A hint like "3 idlis, tea without sugar" makes the result more accurate.
- **My meals**: combos such as idli + sambar + chutney that you log in one tap. You can save any day's meal slot or any photo result as a My Meal.
- **Schedule tab**: regular meals (e.g. 7:00 filter coffee, 4:30 pm tea + 2 Marie biscuits), each with a time, days and meal slot. **Log** adds one to today with a single tap; tap it again to undo. When the scheduled time passes, a **popup asks you to Add or Skip**. Nothing is logged without your OK. "Decide later" hides the popup for 30 minutes, and the Today screen shows a banner until you decide. The app only checks while it's open (a web app can't send background notifications), so prompts for today and yesterday wait for the next time you open it.
- **Custom foods**: enter values from the label of packaged items (e.g. your whey protein), per serving.
- **Offline**: everything is saved on the phone first and synced to Sheets when you're online. The sync status is at the top right.

## Sheet layout
- `Log`: one row per food logged (date, meal, quantity, grams, all 13 nutrients, source photo/manual/auto/meal). Deleting an item soft-deletes it (`deleted = TRUE`).
- `Daily`: totals per day, recalculated by the script on every sync.
- `MyMeals`, `Recurring`, `CustomFoods`, `Settings`: one record per row, stored as JSON.

## Notes
- Values in the food database are typical home-recipe estimates. To change them, edit `foods.js` (one line per food).
- Gemini model: `gemini-flash-latest`, with automatic fallback to free Flash-Lite models. To pin one, set `GEMINI_MODEL` in Script properties.
- Photo calls go through Apps Script, so your API key never sits on the phone. To use a paid Claude key from the phone instead, choose it in Settings → Photo recognition.
