<p align="center">
  <img src=".github/assets/banner.jpg" alt="RoUtility: everything Roblox doesn't show you" width="100%">
</p>

<h1 align="center">RoUtility</h1>

<p align="center">
  USD values, trade tools and a lot of quality of life, built right into Roblox.
  <br>
  <a href="https://chromewebstore.google.com/detail/routility/ecnkdocplhnoclmeenflmcempkmlmpia"><b>Chrome Web Store</b></a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://routility.io"><b>routility.io</b></a>
</p>

<p align="center">
  <img alt="Manifest V3" src="https://img.shields.io/badge/manifest-v3-0F9FFF">
  <img alt="Languages" src="https://img.shields.io/badge/languages-16-0F9FFF">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-0F9FFF">
</p>

---

RoUtility adds the things Roblox doesn't show you to Roblox's own pages. There are no new tabs and no separate site to visit. Everything blends in with the native look, works in light and dark mode, and can be switched off one feature at a time in **Settings → RoUtility**.

## What it does

**Items and Marketplace**
- RoUtility Value, USD price, RAP, demand, trend and copies on every limited, plus the best reseller deals
- Price charts you can flip to your currency, recent trades for the item and who owns it, with serials
- Which of your friends own an item, when you got yours, and how long others have owned theirs
- Avatar Preview, Try In-Game and a Studio style Explorer for any model or accessory

**Trading**
- Values, RAP and price on every offer, with win and loss pills and an overpay warning before you send
- Trade Calculator, Trade Ads and Quick Trade, plus search and filters for your trade list
- Mass Send: send the same offer to the owners of an item, with saved setups, review before sending and a report of how your last run did
- Every trade routility.io tracked for a player, right on their profile, and your own history with them

**Profiles, Friends and Inventory**
- Profile value, RAP and price, Classic Profile layouts and private notes on anyone
- Mutual friends, friend filters, hidden friend lists and Friend History of who was added and who is gone
- Friend request filters by badges, mutuals, followers and join date
- Inventory search, values and a Limiteds category

**Avatar**
- Sandbox: try on anything from the Marketplace or your own items, with backgrounds and the cost of what you don't own
- Customize Thumbnail, Adjust Accessories, wear up to 10 accessories, a skin tone color wheel and an outfit rotator

**Experiences and Communities**
- Server regions with ping, a map and a preferred region, recent servers and player filters
- Exact visits and live stats, store totals, playtime tracking and a Private Servers page
- Friends in a community, exact numbers, and online members you can join

**Creator Hub**
- Script Scanner flags backdoors in Creator Store models before you insert them
- Experience and place IDs, DevEx breakdowns, publishing tier and Robux in your currency

**And more**
- The RoUtility Forum, a chat bot for values and settings, and a command palette
- Desktop notifications for trades, new limiteds and price alerts
- Themes, the 2017 Roblox look, Streamer Mode, Quick Settings and dozens of small fixes
- 16 languages, following your Roblox language

## Screenshots

<p align="center">
  <img src=".github/assets/screenshot-1.jpg" width="49%" alt="Mass Send">
  <img src=".github/assets/screenshot-2.jpg" width="49%" alt="Sandbox">
  <img src=".github/assets/screenshot-3.jpg" width="49%" alt="RoUtility Bot in Roblox chat">
  <img src=".github/assets/screenshot-4.jpg" width="49%" alt="Tracked trades on a profile">
  <img src=".github/assets/screenshot-5.jpg" width="49%" alt="The 2017 Roblox theme">
  <img src=".github/assets/screenshot-6.jpg" width="49%" alt="Value, USD price, demand and trend on an item page">
  <img src=".github/assets/screenshot-7.jpg" width="49%" alt="Trade Calculator with a verdict">
  <img src=".github/assets/screenshot-8.jpg" width="49%" alt="Server regions on a map">
  <img src=".github/assets/screenshot-9.jpg" width="49%" alt="The RoUtility Forum in the classic 2017 style">
</p>

## Install

The easiest way is the [Chrome Web Store](https://chromewebstore.google.com/detail/routility/ecnkdocplhnoclmeenflmcempkmlmpia). It updates on its own.

To run it from this repo instead:

1. Download or clone this repository
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and pick the folder with `manifest.json` in it
4. Open [roblox.com](https://www.roblox.com) and you're set

It works in Chrome, Edge, Brave, Opera and other Chromium browsers. There is no build step. The files here are exactly what the browser runs.

## How it works

If you want to build your own Roblox extension, this is a quick tour of how RoUtility is put together.

**Content scripts** do almost everything. They run on roblox.com in Chrome's isolated world, watch the page with a `MutationObserver`, and add RoUtility's pieces into Roblox's own elements. The page is never replaced. New UI reuses Roblox's CSS classes, so it looks native and follows the theme automatically. `src/core/ui.js` holds the shared helpers (building elements, prices, tooltips, friend lists, inventories) and loads first.

**Page scripts** are the `*-main.js` files, kept next to the feature they belong to. They run in the page's own world so they can see Roblox's own network responses, for example the inventory list or the server list, and pass the useful bits back to the content scripts with `postMessage`.

**The background service worker** (`src/background/background.js`) fetches item values from routility.io, sends desktop notifications, runs scheduled jobs like the playtime counter, and answers requests from the content scripts.

**Calls to Roblox** go straight from your browser to Roblox's public web APIs, the same ones roblox.com itself uses. Your Roblox cookie and password are never read or sent anywhere.

**Translations** live in `locales/` (16 languages). UI text goes through small `lt()` helpers from `src/core/i18n.js`.

| Path | What's inside |
| --- | --- |
| `manifest.json` | Permissions, which script runs on which page, and load order |
| `src/background/` | Service worker: values, notifications, alarms, context menu |
| `src/core/` | Shared pieces every script uses: `ui.js` helpers, `i18n.js`, `net.js`, and `content.js`, the router that turns features on for the page you're on |
| `src/features/` | One folder per area (profile, trading, avatar, items, friends, games…), with any `*-main.js` page scripts it needs |
| `src/settings/` | The RoUtility tab inside Roblox Settings |
| `src/create/` | Creator Hub extras |
| `src/preview/` | 3D try on preview |
| `styles/` | Stylesheets |
| `assets/` | Icons and flags |
| `vendor/` | three.js and the Draco decoder |
| `locales/`, `_locales/` | Translations |
| `rules/` | Declarative network rules (one header for server regions, page redirects) |

## Privacy

RoUtility only talks to Roblox and to routility.io, which serves item values, server regions, the forum and trade ads. Nothing is sold and there are no ads or trackers. Most settings and history never leave your browser. The full policy is on [routility.io](https://routility.io).

## What's new

See [CHANGELOG.md](CHANGELOG.md) for every update, what changed and who helped. The same log is inside the extension under Settings > RoUtility > What's New.

## Contributing

Found a bug or have an idea? Open an issue. Pull requests are welcome too. Please keep changes in the same style as the code around them, and test them on a few real pages first.

## License

RoUtility is released under the [MIT License](LICENSE). three.js and the Draco decoder keep their own licenses, listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

RoUtility is not affiliated with, endorsed by or sponsored by Roblox Corporation. Roblox is a trademark of Roblox Corporation.
