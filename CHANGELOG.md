# Changelog

Every RoUtility update, what changed and who helped. The same log is in the extension under Settings > RoUtility > What’s New.

## Everyone who helped

- Code: [@reqonn](https://github.com/reqonn), [@awkward222](https://github.com/awkward222)
- Bug reports and ideas: [@reqonn](https://github.com/reqonn), api_cats

## 1.1.5 · October 16, 2026

Every Roblox Plus theme for free, when you joined each community, Fun Outfits, and Try On that keeps your hats.

**New**

```diff
+ RoUtility Values on profiles: the price and Robux Value share one pill next to the green RAP pill. Pick which of the three you see in Settings > Inventory > Inventory Values.
+ Hidden Item Details: when an item's page is hidden, like an archived or unreleased item, RoUtility rebuilds it with its picture, creator, type, dates, favorites and description instead of a 404.
+ Smarter Inventory Search: when you make or counter a trade, searching an inventory also finds items by acronym, like CWS for Clockwork's Shades, and shows suggestions as you type.
+ Quick Settings Style: List, Tiles or Compact, a single line with your online status that opens the settings when you click it. Quick Settings also looks quieter and lines up with the menu. (by @reqonn)
+ Recent Servers: a game's Servers tab lists the servers you played in lately, so you can jump back into one while it's still running.
+ Proof: a Proof button on trades makes a clean picture of the trade and fills in the text for a value request on the RoUtility Discord, ready to copy. Hide prices or RAP in the picture if you want.
+ Roblox Plus Themes, free: all 15 of Roblox Plus's own themes, like Cosmic Dust, Polar Freeze, Lava Glow and Classic, for everyone. Pick one in Themes and every page changes color, in light and dark mode.
+ Joined Date: see when you joined a community, as a pill next to its Created date.
+ Fun Outfits: in Fun Mode, save looks with items you don't own yet, wear them again later, and see what they'd cost to buy for real.
+ Turn Off Values: one button under Quick Setup turns off every price, RAP and value RoUtility adds, and leaves everything else as it is.
+ Price and R$ Value on the Wearing panel can now be turned off on its own.
```

**Improved**

```diff
~ Classic profiles show your nicknames for friends, and avatars Roblox hasn't approved show a gray silhouette everywhere instead of a broken file icon. (by @reqonn)
~ Roblox's Try On on item pages keeps the hats and accessories you're wearing instead of taking them all off.
~ Greyed out settings now say which setting to turn on first.
~ An Open Source on GitHub link on the About page.
~ Banned profiles show a red Banned tag next to the username and a ban badge on the avatar, like Roblox's app.
```

**Fixed**

```diff
- Trade Calculator and Trade Ads have the same side spacing as Home instead of running into the menu and the window edge on wide screens.
- Joining a friend from their profile no longer says you're in the game before Roblox even opens, and the join window now shows their server's players, ping and performance instead of dashes.
- Robux you add to an offer now count in the overpay warning and the Send summary.
- Avatar changes show up right away instead of after a day. (by @reqonn)
- The device and location filters on Charts no longer drop to the bottom of the page.
- Other Extensions forgets extensions you've uninstalled.
- Gear like the Darkheart shows its real color in Avatar Preview instead of looking like a Linked Sword.
- Fake Purchases now also blocks private server purchases and renewals, so real Robux are never spent while it is on.
- Changing Online Status in Quick Settings no longer opens up who can join you.
- Trade price differences count the Robux in each offer.
- Amounts like 12,50 or 1.000 are read correctly in the Trade Calculator and Trade Ads.
- Off-sale hats no longer show as LIMITED on classic profiles.
- Profiles no longer show $0 when prices can't load.
- Trailers you start yourself keep playing with Stop Trailer Autoplay on.
- The unfriend detector keeps working after a big change in your friends list.
- Price alerts past your 25th are checked too.
- A lot of smaller fixes from a full bug sweep.
```

## 1.1.4 · October 15, 2026

Send Robux without the app, prices in your own currency, much more customizable themes, a second classic profile layout, and updates that clean up after themselves.

**New**

```diff
+ Send Robux right from the browser: pick a friend in Buy Robux > Send, or press Send Robux on a profile, choose an amount and confirm, without opening the Roblox app. (by @reqonn)
+ Currency: see every price RoUtility adds in USD, EUR, GBP, CAD, AUD, JPY, CNY, KRW, INR, BRL, MXN or TRY, the same currencies as routility.io. Your Robux rate can be in your currency too.
+ Old Left Menu: bring back Roblox's old left menu, with Trade Calculator, Trade Ads, Forum, the Collapse button and Quick Settings in the same style, and your arranged order applied. It switches as soon as you flip it. (thanks reqonn)
+ Custom Theme: more colors (Buttons, Play Button Text, Borders, Success, Warnings), background effects like Glow, Aurora, Grid, Dots, Flowers or your own image, blur, tint, card transparency and roundness. (by @reqonn)
+ Website Font: use your own font file. (by @reqonn)
+ Sakura, a light pink theme preset. (by @reqonn)
+ Classic Verified Badge: the original verified badge from 2022, with sharp corners and the brighter blue. (by @reqonn)
+ Selected Tab: pick how the open tab looks in side menus, just the highlight or a colored bar with it like Roblox. (by @reqonn)
+ Classic Profile Layout: a Two Columns option, with About, badges and communities on the left and experiences, friends and favorites on the right. (by @reqonn)
```

**Improved**

```diff
~ Settings are easier to find: new Classic Roblox, Account & Security and Inventory tabs, a Money section at the top of Robux & Transactions, and Trade Ads moved into Trading.
~ The settings menu is grouped into Browsing, Appearance, Social, Games, Marketplace and Account, with a search at the top that shows every matching setting, and it matches Roblox's own settings menu. (by @reqonn)
~ Faster pages: requests that don't depend on each other go out together, repeated lookups are shared, and classic profiles load in about a second. (by @reqonn)
~ Menus, dropdowns, the category lists and the classic profile follow custom themes. (by @reqonn)
~ Going back to a classic profile you just saw loads instantly. (by @reqonn)
```

**Fixed**

```diff
- Profile loading placeholders now sit exactly where the profile appears, instead of jumping sideways on wide screens.
- The launch window now notices when you've joined a game. (by @reqonn)
- Fewer rare glitches: notifications showing twice, Cancel Request acting on the previous profile, unavailable game pages retrying in a loop, and a failed Explorer download needing a reload. (by @reqonn)
- Tabs left open during a RoUtility update no longer show errors or a leftover settings page. (by @reqonn)
```

## 1.1.3 · October 15, 2026

A big one: new tools for Roblox Plus, your account and communities, a page for games Roblox won't show you, and the first changes from people outside the team.

**New**

```diff
+ Unavailable game page: private and hidden games show their name, creator, why they're unavailable, favorites, likes, description, badges and passes instead of "Content not accessible".
+ Your Robux Rate: set your own dollars per 1,000 Robux and every USD number uses it, including Community Funds and the Creator Hub.
+ Roblox Plus page: when Plus renews, where you're billed, your savings in dollars, what Plus has cost you and when your next discount unlocks.
+ Transfer limits: how much you've sent and how much you can still send today and this month, plus the per transfer limit.
+ Settings > Security shows the IP address of each logged in device and when your backup codes were made.
+ Settings > Privacy tells you if your voice chat is suspended and until when.
+ Community pages show when the community was created, and the side list shows how many communities you're in out of the limit.
+ Avatar Type row on experience pages: R6, R15 or player's choice.
+ Creator Hub tags on restricted experiences, like Hidden from discovery or Purchases blocked.
+ Friends Since: the date two people became friends, under every card on any Friends list. (by @reqonn)
+ Sort Trade Inventories by Price: the most valuable items come first when you make or counter a trade. (thanks api_cats)
+ Remove heads and body parts one by one from the avatar editor's Wearing panel.
+ Searching an old username finds the person and shows "formerly" with their old name.
+ Theme matched scrollbars, with an optional floating style. (by @awkward222)
+ Classic Premium Icon: bring back the old Premium icon next to names. (by @reqonn)
+ Fun: Refill Robux keeps your fake items and fills your fake balance back up.
+ Fun: Fake Friend Requests. (by @reqonn)
```

**Improved**

```diff
~ Mutual friends and friend lists load a lot faster.
~ Friends Own This uses Roblox's own data, so it's instant.
~ Inventory search and sort use cards that look like Roblox's own.
~ Menu settings apply right away, classic names no longer flash in, and profiles use less memory. (by @reqonn)
~ The settings menu is rounded and follows your theme. (by @reqonn)
~ RoValra's Rolimons value pill sits on the same line as RoUtility's value pills.
~ Streamer Mode blurs your name in the Home greeting and device IP addresses.
~ Your primary community comes first on classic profiles.
```

**Fixed**

```diff
- Turning off Trade Values no longer hides Search Trades by Item and the other trade tools. (thanks api_cats)
- Switching accounts no longer floods you with Trade Completed notifications.
- Faces on R15 avatars without a head item drew in the wrong place in previews.
- The collapsed left menu squeezed Roblox's news feed into one letter per line.
- The "Shown via RoUtility" badge on hidden friends floated over the loading skeleton.
```

## 1.1.2 · October 14, 2026

A round of fixes from friends' bug reports, and faster loading.

**Improved**

```diff
~ RoUtility's scripts are bundled and minified, so pages load faster.
```

**Fixed**

```diff
- Sixteen bugs reported by friends, across trades, profiles, the calculator and settings.
```

## 1.1.1 · October 14, 2026

RoUtility speaks your language.

**New**

```diff
+ RoUtility in 16 languages, following your Roblox language by default.
+ Quick Setup: pick Just Values, Recommended or Everything in one click.
+ Outfit Rotator, Manage Badges with auto delete, and more Quick Settings rows.
```
