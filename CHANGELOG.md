# Changelog

Every RoUtility update, what changed and who helped. The same log is in the extension under Settings > RoUtility > What’s New.

## Everyone who helped

- Code: [@reqonn](https://github.com/reqonn), [@awkward222](https://github.com/awkward222)
- Bug reports and ideas: [@reqonn](https://github.com/reqonn), api_cats

## 1.1.8 · October 21, 2026

RoUtility badges and friend request messages, plus server region and profile fixes.

**New**

```diff
+ Custom Name Badges (Fun): pick Verified, Roblox Plus, Premium and Roblox Admin for your own name. They show everywhere Roblox shows badges, in Roblox’s order, and start with the ones you really have. Roblox Admin also adds the Administrator badge to your Roblox Badges.
+ Classic Admin Badge (Classic, off by default): the old red R logo as the Roblox admin badge next to names, and the old Administrator badge in Roblox Badges.
+ Try In-Game: a button on item and bundle pages that opens Avatar Sandbox with the item already on your avatar, so you can see it in a real game before you buy.
+ Profile Notes: write a private note on anyone’s profile, like on Discord. Only you can see it, and once you verify with Roblox it’s backed up so it comes back on your other browsers. (by @reqonn)
+ Profile Pill Style: show Value and RAP joined, in separate colors or all gray. Pills now go Value, RAP, then Price, and private inventories show a lock. (by @reqonn)
+ RoUtility Badge and Friend Request Messages: verify with Roblox once and other RoUtility users see a small RoUtility logo next to your name. When you add a RoUtility user, you can include a short message, and messages people send you show on your Requests page. Links and contact info aren’t allowed, and you can report or block anyone. (by @reqonn)
+ Hover a verified, Roblox Plus, Premium or admin badge next to someone’s name on their profile to see what it is. (by @reqonn)
+ Terminated players show their avatar on their profile, and pasted or outside links to terminated profiles open them too. (by @reqonn)
+ Online Friends First (Profiles, off by default): the 2022 profile’s friends row shows who’s in a game, in Studio or online first, like Roblox’s own profile.
```

**Improved**

```diff
~ Your playtime on a game page sits under its name now, with Today, Past 7 Days, Past 30 Days or All Time. Hover the time for the exact minutes and when you last played.
~ Roblox Badges on the 2022 profile are sharp instead of blurry.
~ Prices show a simple green $ (or your currency’s sign) before the amount instead of the round money icon.
```

**Fixed**

```diff
- Quick Settings in the Original Sidebar shows full names and values like Trusted Friends instead of cutting them off, and its option lists fit on screen. Dropdown lists that are too long now scroll.
- Item pages whose address ends up with only the item’s name (no number) show RoUtility’s values and tools again.
- Server Regions: Play with a region picked (like Miami) finds servers in that region that actually have room, instead of saying there are none or sending you to one that just filled up.
- Cancel Request shows right after you send a friend request. (by @reqonn)
- Home: the friends row no longer shows a loading placeholder when you have no friends, and the greeting shows your current avatar. (by @reqonn)
- Search: names in the search box are readable in light mode. (by @reqonn)
- A startup error on some profiles is gone. (by @reqonn)
- Fun Mode: heads from bundles you bought, like Headless, now show on your headshot on Home and everywhere else, and replace the head you really wear.
- Fun Mode: limiteds you bought now add to the RAP, Value and USD under your name on your profile.
- Fun Mode: limited bundles you bought, like Dynamic Heads, show as Owned Items on the item page.
```

## 1.1.6 · October 20, 2026

Fixes the store build of 1.1.5, plus fixes for search, Home, the classic profile and Customize Thumbnail.

**Fixed**

```diff
- In the store version of 1.1.5, the settings page stayed empty and features that rely on RoUtility’s background work (values, prices, notifications and more) didn’t load. Everything works again.
- Search suggestions only highlight one row at a time: the one under your mouse, or the one you picked with the arrow keys.
- Home section titles like Continue and Recently Updated are only clickable on the title and arrow now, not across the whole empty row.
- Classic Profile Layout: the profile’s primary community shows first in Communities again.
- Classic Profile Layout: turning the page in Favorites on Two Columns shows the next favorites instead of an empty box.
- Classic Profile Layout: on Two Columns, people with no experiences or favorites get an Experiences or Favorites box that says so, instead of those sections just disappearing.
- Customize Thumbnail: Field of View and Rotation now apply to your Full Body thumbnail too, so it faces the way the preview shows instead of Roblox’s default angle.
```

## 1.1.5 · October 16, 2026

Every Roblox Plus theme for free, when you joined each community, Fun Outfits, and Try On that keeps your hats.

**New**

```diff
+ Spending: a button next to Buy Robux on My Transactions opens your total spent and what you’ve spent on each creator, experience, item type and month, for all time or a date range, with search. Your purchases are saved on this device, so later visits only check for new ones.
+ You’ve Spent: experience pages show how many Robux you’ve spent in that experience, next to the other stats.
+ RoUtility Values everywhere: the item page, Marketplace, inventories, Make Offer, the Trade Calculator, Trade Ads, search, the avatar editor and item hover cards now show Value next to RAP and price. One switch turns them all off: Settings > Robux & Transactions > RoUtility Values.
+ One icon for each number everywhere: the RoUtility logo means Value, the green dollar icon means price, and the Robux icon means RAP. Marketplace tiles, Similar Price and the Collectibles window show Value on its own line.
+ Trade Proof shows RoUtility Value too: on every item, in each side's totals and in the difference, with a Value switch next to RAP and Prices.
+ Short Numbers on Profiles: show the profile pills like 7.27M+ instead of the full number. Value now uses the RoUtility logo, price a dollar icon and RAP the Robux icon, so they never look alike.
+ RoUtility Values in trades: every item shows its RAP, Value and price, each side gets a Value total under the RAP total, and there are RAP, Value and price difference pills. Pick which two pills your trade list shows: RAP and Price, Value and Price, or RAP and Value.
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
+ Real Items First: Marketplace searches show Roblox’s own matching items first, offsale ones included, instead of burying them under copies. Limited acronyms like RSTF or Emp put the real item on top.
+ Inventory Search can search All Items at once: pick All Items next to the search box instead of going category by category.
+ Favorites pages get the same search box, by category or across All Favorites, with limited acronyms too.
+ Limited item pages get an Owners chip next to Friends own that jumps straight to the full owners list. Hidden owners show as your friend when the copy is theirs.
+ Price charts can show 7 Days, 1 Year and All Time, with volume, on top of Roblox’s 30, 90 and 180 days.
+ Manage on the Following tab: pick people and unfollow them all at once.
```

**Improved**

```diff
~ Apply in Adjust Accessories updates your avatar right away instead of reloading the avatar editor, and the editor keeps your adjustments when it saves later. (by @reqonn)
~ Classic profiles show your nicknames for friends, and avatars Roblox hasn't approved show a gray silhouette everywhere instead of a broken file icon. (by @reqonn)
~ Roblox's Try On on item pages keeps the hats and accessories you're wearing instead of taking them all off.
~ Greyed out settings now say which setting to turn on first.
~ An Open Source on GitHub link on the About page.
~ Banned profiles show a red Banned tag next to the username and a ban badge on the avatar, like Roblox's app.
~ Limited acronyms like RSTF, CWHP or Emp now work in Inventory Search and the avatar editor’s item search.
~ Hovering a friend on Home adds their friend and follower counts, join date and how long you’ve been friends to Roblox’s Chat and View Profile menu.
~ The 2022 profile says which game someone is playing or editing in Studio, under their name.
~ The Emotes menu in Item Preview lists every emote you own, not just the ones you have equipped.
```

**Fixed**

```diff
- Unfriending someone from a classic profile no longer leaves Roblox’s menu stuck at the top left of the page.
- The three dots on Home game tiles sit in the middle of their button.
- The Trade Calculator sits centered with room on both sides instead of running into the menu and the window edge on wide screens, and its loading skeleton matches.
- Joining a friend from their profile no longer says you're in the game before Roblox even opens, and the join window now shows their server's players, ping and performance instead of dashes.
- Robux you add to an offer now count in the overpay warning and the Send summary.
- Classic profiles update their friends and count in place when you or a friend unfriends someone, instead of showing the old list, and no longer get stuck loading. (by @reqonn)
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
- Fun Mode: your fake Robux no longer turns into a ? after buying or changing the amount.
- Fun Mode: picking a lower Robux amount after buying things starts from that amount instead of dropping to 0.
- Fun Mode: T-shirts you buy show first in your inventory, and heads and faces get their own Classic Heads and Classic Faces tabs under Heads.
- Hovering a big number in the avatar Wearing totals no longer spills into the next box.
- Server regions show up on the servers you can see within a few seconds, instead of sometimes waiting behind the map's background sample, and the map no longer goes missing on games RoUtility hasn't counted yet.
- Searching someone's old username puts them first again when Roblox is slow to answer, instead of sometimes dropping the "formerly" match.
- Try On keeps every hat you’re wearing (up to 10 accessories) instead of taking one off when you try a hat with 3 already on.
- The USD price under items in the avatar editor no longer gets cut off when an item has a Value and a long name.
- Favorites pages no longer shuffle their items around when you change page.
- Clicking an item in Similar Price on a limited’s page opens it properly instead of a broken page without the item’s ID.
- Inventory cards with RAP, Value and price lines no longer spill into the row below when the item has a long name.
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
