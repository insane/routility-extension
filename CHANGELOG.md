# Changelog

Every RoUtility update, what changed and who helped. The same log is in the extension under Settings > RoUtility > What’s New.

## Everyone who helped

- Code: [@Scripzy](https://github.com/Scripzy), [@primary999](https://github.com/primary999), [@reqonn](https://github.com/reqonn), [@awkward222](https://github.com/awkward222)
- Bug reports and ideas: [@reqonn](https://github.com/reqonn), api_cats

## 1.3.4 (November 24, 2026)

Mass Send takes your 2-Step code, shows how your last run did and saves your setups, Sandbox gets one row of categories, backgrounds and a buy button, and profiles get a Trades section.

**New**

```diff
+ 2-Step Verification (Mass Send): when Roblox asks to check it’s really you, type your code right in Mass Send and it keeps sending, instead of sending a trade from Roblox’s trade window.
+ Mass Send: if Roblox needs you to verify while you’re in another tab or app, a notification tells you, and clicking it takes you back.
+ Reset who I’ve sent to (Mass Send): in the Skip menu, forgets who you already mass sent to, so you can send the same people a new offer, like one with more Robux.
+ How many items (Mass Send): choose exactly how many items Shuffle adds to each trade, or leave it on Any number.
+ Last run (Mass Send): see how your last run did, with how many trades were accepted, countered, declined or are still waiting.
+ Saved setups (Mass Send): save your items, what you want and every option, then load it again in one click.
+ Cancel unanswered trades (Mass Send): have Mass Send trades nobody answered cancel after 1, 2 or 3 days, even while Roblox isn’t open, or cancel the ones still waiting right away.
+ My Items (Sandbox): switch between your own items and the whole Marketplace.
+ Backgrounds (Sandbox): try any Marketplace background behind your avatar without changing your real one.
+ Redo (Sandbox): next to Undo, brings back what you just undid.
+ Buy what you don’t own (Sandbox): a button under Outfit Worth shows what the pieces you don’t own cost, with your Roblox Plus discount, and lists each one with a link to buy it.
+ Old Roblox Dark and Neon Sunset, two new theme presets.
+ Queue (Mass Send): line up several offers with the button between You Offer and You Want, and Start Sending runs them one after another. Each card shows the Value and Price difference, and you can cancel any of them.
+ Backup codes (Mass Send): paste up to 10 of your 2-Step backup codes and Mass Send uses one each time Roblox asks, so it keeps sending. They’re never saved.
```

**Improved**

```diff
~ Mass Send: a simpler page, with every choice in a short row of dropdowns instead of rows of buttons.
~ Sandbox: one row of categories replaces Roblox’s hover menus, starting on All so you can browse everything at once.
~ Trades on profiles: tracked trades moved out of the profile header into their own Trades section with totals and the last 3 trades. The popup shows each trade’s items right away, with All Trades and With You as tabs, and With You shows what you gave and got in each trade.
~ Gains and losses now read sign, icon, amount everywhere, like − 105K, in trade pills, the trade calculator and share images.
~ Hovering an item in tracked trades, item trades, trade ads, trade previews and the chat bot shows the same card with its Value, Price and RAP, like on routility.io.
~ Mass Send: skips people who no longer have the item right away, instead of looking through their whole inventory first.
~ Your Trade Settings: click Filter or From under Trades to change your trade quality filter or who can send you trades, without going to Privacy settings.
~ Hidden friend lists with BTRoblox: when BTRoblox's profile is on, RoUtility's friends now show in its Friends box instead of a greyed-out list you can't click.
~ Friend Requests: Search and Filter stay on the main Friend Requests row when you have Trusted Friend Requests, and make room for RoValra's Filters button instead of covering it.
~ 2017 Roblox theme and custom fonts: icons added by other extensions like RoValra show properly again, instead of turning into words like lock-closed.
~ Wearing list: removing a hat after wearing an outfit no longer messes up your avatar, since the outfit's layering and accessory adjustments are now kept.
~ Free Trades Left: hovering Unlimited trades now says it comes with Roblox Plus or Premium, since Premium members trade without limits too.
```

**Fixed**

```diff
- Sandbox: no longer lands on the last Avatars page you had open.
- Sandbox: the Limiteds tab only shows on your real avatar, since Sandbox already has its own Limiteds filter.
- Limited alerts: items that just became Limited no longer say Free, since they can only be bought from resellers.
- Trades: refreshing a counter offer takes you straight back to it instead of Roblox’s Page Not Found.
- Customize Thumbnail: the preview no longer leaves off your pants or shirt when you wear body parts like R6 Girl.
- Avatar previews: some older items like Twin Kodachi no longer show up plain white.
- RoUtility Bot: item and player cards show round numbers right, like 310K instead of 31K, with the Value and Robux icons.
- Trades on profiles: the Trades section no longer goes missing for a few minutes when routility.io briefly answers with no trades.
- Trades on profiles: Value in tracked trades and in With You now uses what each item was worth when the trade happened, like routility.io’s Trade Tracker, instead of today’s values.
- Inventory: switching from Limiteds to another category like Animations no longer leaves the inventory blank.
- Trades on profiles: with Classic Profile on Two Columns, the Trades section sits in the left column instead of below a big empty gap.
```

## 1.3.3 (November 23, 2026)

Mass Send can wait for you to check each trade before it goes out, lets you choose what kind of items it adds, counts your trades left better and reads 20k in Add Robux.

**New**

```diff
+ Review each trade (Mass Send): turn it on under More options and every trade waits for you to press Send or Skip before it goes out.
+ Shuffle and value range adds (Mass Send): under More options, pick the demand the added items need and never add unvalued items, faces, gear or items that are dropping or unstable.
```

**Fixed**

```diff
- Mass Send: trades left today is more accurate, since trades that were declined or countered no longer drop out of the count.
- Mass Send: typing 20k or 1.5m in Add Robux now adds 20,000 or 1,500,000 Robux instead of 20 or 1.
```

## 1.3.2 (November 21, 2026)

See the data Roblox loads but never shows, play in your region again, find your limiteds in their own tab in the avatar editor and inventory, and keep Robux out of your item slots in trades.

**New**

```diff
+ Limiteds Tab (Avatar): a Limiteds tab after Gear in Accessories with every classic limited you own, ready to wear. It stays open when you refresh.
+ Limiteds Category (Inventory): every limited in an inventory in one place under Accessories, highest RAP first, with serials and on hold items marked.
+ Shuffle (Mass Send): set how much more you want, like +15%, and Shuffle fills You Want with one to four items that match it in USD and Value, favoring good demand.
+ Owned For (Mass Send): drag a range to only send to people who’ve had the item for a certain time, like 3 days to 2 years, or skip owners who’ve held it 5+ years.
+ Creator Hub: Copy Universe ID, Copy Place ID, Copy URL and View on Roblox in the menu on a place’s settings page.
+ DevEx Breakdown (Creator Hub): how many of your Robux cash out at $0.0035 and how many at $0.0038, the exact total, your last cash-out and when you can cash out next.
+ 18+ DevEx Rate (Creator Hub): each experience overview says whether its Robux from players 18 and over can cash out at $0.0054, and what to change if it can’t.
+ Compared to Similar Experiences (Creator Hub): your retention, playtime, home page play rate and spending next to the average and top 10% of your genre.
+ Creator Hub: public launches left next to your publishing tier, the Limited resale split in Avatar items, and Robux still pending from sales on Transactions.
+ Plus Savings in Stores: a game’s Store shows the price before your Roblox Plus discount, crossed out next to what you pay.
+ Your Trade Settings (Trades): your trade quality filter and who can send you trades, under Unlimited trades.
+ Username Change Price (Settings): what changing your username costs, with the price before your Roblox Plus discount.
```

**Improved**

```diff
~ Trade Ads and Mass Send: Robux no longer take up an item slot, so all 4 stay free for items. In Mass Send you type Robux straight into Add Robux.
~ Trade Ads and Mass Send: add the same item more than once, with a count on the card and a button to remove one.
~ Mass Send: people you couldn’t send to, like those with trades turned off or a private inventory, are skipped for a week instead of being checked again every run.
~ Closest region (Servers): picks from Roblox’s own list of the servers with the best connection to you.
~ Trades: your trade filter and who can trade with you show as pills next to Unlimited trades.
~ What’s New (Settings): updates are split into pages of five instead of one long list.
~ Adjust Accessories: Scale is one Size slider that scales the whole accessory, and the preview fits all of your accessories instead of zooming in on your head.
```

**Fixed**

```diff
- Region play (Servers): picking a region works again with Roblox’s new Play button, waits when Roblox is busy instead of joining any server, and skips servers you were just sent to.
- Friends: accepting, ignoring or unfriending no longer sends the list back to page 1, and request times stay on the right person.
- Communities: Hidden Experiences only shows on the Home tab instead of inside Posts.
- Trades: Robux in a trade now count everywhere, in the totals, the pills and the trade list. Robux you get count after Roblox’s 30% fee.
- Friends: terminated friends with a verified badge no longer show two checkmarks.
- Adjust Accessories: your adjustments stay when you change anything else on your avatar, even after a refresh.
- Navigation: no second verified badge next to your name on pages where Roblox shows its own.
- Search: Search in People no longer flashes highlighted while results load.
```

## 1.3.1 (November 20, 2026)

RoUtility works properly on Roblox’s newer pages again, Mass Send can’t send anyone the same trade twice, and the avatar Wearing list no longer removes the wrong item.

**Fixed**

```diff
- Roblox’s newer pages: RoUtility knows who you are there again, so your left menu layout, Fun Mode badges and the other features that need your account keep working.
- Mass Send (Trades): if your connection drops while sending, it checks your outbound trades before trying again, so nobody gets the same trade twice. Stopping a run no longer skips the person it was on when you press Continue.
- Wearing (Avatar): clicking your head no longer takes a while and removes a different item. Heads stay on like faces, since Roblox only lets you swap them.
- Trade window: stops asking Roblox for the same trade over and over when it can’t tell who you’re trading with.
```

## 1.3.0 (November 19, 2026)

Mass Send can continue after Roblox’s check instead of starting over, a few settings that showed as off now show correctly, and settings previews fit in every language.

**Improved**

```diff
~ Mass Send (Trades): when Roblox stops a run to check it’s really you, a Continue button picks up where it left off instead of starting over.
```

**Fixed**

```diff
- Settings: Mass Send, Trade History With Them, You’ve Spent, Real Items First and Spending Breakdown showed as off even though they were on.
- Settings: previews no longer get cut off or spill out of their box in longer languages.
```

## 1.2.10 (November 19, 2026)

Customize Thumbnail loads your avatar and emotes again on Roblox’s newer avatar page.

**Fixed**

```diff
- Customize Thumbnail (Avatar): your avatar picture and emotes load again for accounts Roblox moved to its newer avatar page, so you can see and change your headshot angle.
```

## 1.2.9 (November 19, 2026)

Item pictures show again when you open a trade in Trade History.

**Fixed**

```diff
- Trade History (Trades): the item pictures under View Trade load again for everyone.
```

## 1.2.8 (November 19, 2026)

Mass Send sends one offer to everyone who has what you want, Quick Trade opens a trade from a username or link, the trade window and profiles show someone’s trade history, and values update live while you watch.

**New**

```diff
+ Quick Trade (Trades): type a username or paste a profile link and the trade opens straight away, with the people you traded with last one click away. It’s in the menu next to Trades and in the command palette. (by @Scripzy)
+ Mass Send (Trades): set up one offer and send it to everyone who owns what you want, from RoUtility’s owner list or Trade Ads. It checks each person’s inventory right before sending, skips anyone who no longer has the item, keeps track of Roblox’s 100 trades a day and waits out its limits by itself. An item range can fill the rest of your request with their own items, and Test Run shows who would get the trade without sending anything. Open it from the menu next to Trades. (by @Scripzy)
+ Trade History With Them (Trades): on the trade window and on profiles, see how many trades you’ve had with someone and how many went through, plus every trade routility.io tracked for them with anyone, with the Value and USD each one gained or lost.
+ Live Value Changes: on item pages and trades, values and prices update every few minutes without a refresh, and flash green when they go up or red when they go down.
```

**Improved**

```diff
~ Clean Up Trades: cancel outbound trades that got worse for you since you sent them, or that you sent more than a day ago.
```

**Fixed**

```diff
- Classic Profile Layout: the list of previous usernames is no longer cut off on the left.
- Skin Tone by Body Parts (Avatar): after you change outfits, the color wheel and the highlighted color show each part’s real color instead of your previous avatar’s.
```

## 1.2.7 (November 18, 2026)

The Clans & Guilds forum is back, the 2017 theme scrolls properly again, Adjust Accessories opens about four times faster, and the chat bot tells you which other extensions it found.

**New**

```diff
+ Clans & Guilds (Forum): the old Club Houses forum for your clans, groups and guilds is back, with its pinned rules.
```

**Improved**

```diff
~ Other extensions: the chat bot tells you once which ones it found and what RoUtility hides because of them.
~ Classic Profile Layout is off by default, so profiles look like Roblox’s own until you turn it on in Settings. The 2017 Roblox Theme still uses it.
~ Fake Robux (Fun Mode): Multiply your Robux takes any number you type, like 1.5 or 5000, instead of a fixed list. Long choices in settings menus are no longer cut off.
~ Adjust Accessories opens about four times faster, and your accessories show right away while the 3D preview loads.
```

**Fixed**

```diff
- 2017 Roblox Theme: pages no longer slide down a little when they finish loading, and your first scroll moves the whole page again.
- 2017 Roblox Theme: Catalog cards no longer leave a big empty space under the price.
- 2017 Roblox Theme: the Refresh buttons on the Servers tab have a white icon with room around it.
- Classic Profile Layout: your new About shows right after you change it, instead of the old one for a few minutes.
- Chat: the resize hint no longer gets stuck on screen while you drag the corner.
```

## 1.2.6 (November 17, 2026)

Plays nicer with RoValra, RoSeal, RoPro, BTRoblox and RoQoL, Avatar Editor and Sandbox fixed on Roblox’s newer avatar page, hidden items open again, Classics gets a year picker and See All, and the Continue row puts what you played last first.

**New**

```diff
+ Roblox Logo: the red one with the tilted O from 2017 to 2018.
+ Last Played First (Home): the Continue row is sorted by when you last played each experience, newest first.
+ Roblox Logo: pick today’s logo, the red and white one from 2006 to 2016, or the one with the tilted O from 2017 to 2022.
```

**Improved**

```diff
~ Classics (2017 Roblox Theme): games Roblox won’t let you join are left out.
~ 2017 Roblox Theme: the Avatar type and Body Type sliders sit on a white card like the old Avatar Editor.
~ Classics (2017 Roblox Theme): up to 80 front page games for each year from 2012 to 2019 instead of about 12, pick the year right on the Games page, and See All opens them all in a grid.
~ Other extensions: when RoValra, RoSeal, RoPro, BTRoblox, RoQoL or another extension already shows the same row, link or button, RoUtility hides its copy so nothing shows twice. This covers Demand and Trend, Friends Own, Avatar Type, Sandbox in the menu, Filter Items, the R6 and R15 switch, and BTRoblox’s profile.
~ Servers: the Join When Open button is gone.
```

**Fixed**

```diff
- Avatar Editor and Sandbox work again for accounts Roblox moved to its newer avatar page, where every RoUtility avatar feature was missing, and Sandbox shows what you try on there.
- Admin badges show again next to friends on Home after Roblox changed its friend tiles, and now on profile friend lists too.
- Hidden items open again. Roblox now sends hidden item pages to the Marketplace, so RoUtility stops that and rebuilds the page.
- Friend History, Trade Calculator and Trade Ads no longer copy the Friends or Trade counter when Roblox draws it differently.
- Avatar Editor: Roblox’s R6 and R15 switch and Advanced button stay visible when its layout doesn’t match what RoUtility expects.
- 3D previews: newer accessories like Ghostly Pumpkin Head show up in Adjust Accessories, Sandbox and the other previews instead of going missing.
```

## 1.2.5 (November 15, 2026)

Things Roblox loads but never shows: who really uploaded an item, sale details and seller fees, free trades left, and Kids & Select progress on Creator Hub.

**New**

```diff
+ Sale Details (Item Pages): item pages show which game sells an item, how many are left, the limit per person, when the sale ends and how many times it was restocked. Roblox loads all of this but doesn’t show it.
+ Uploaded By (Item Pages): when someone other than the listed creator uploaded an item’s mesh and textures, like group items or Roblox items made by UGC artists, the item page shows who, with their picture and @username.
+ Seller Fee (Item Pages): resellable items show how much Roblox keeps when you sell one and the lowest price you can list it for. Hover it to see what you’d get.
+ Free Trades Left (Trading): under Trades, see how many of your free trades are left this month, or Unlimited trades with Roblox Plus.
+ Allowed Gear (Game Pages): a Gear row with the gear types a game lets players bring in.
+ Maturity Reasons (Game Pages): hover the Maturity label at the top of a game page to see why it got that rating.
+ Trusted Friend Check (Profiles): Add trusted friend greys out when Roblox won’t let you add that person, and hovering it says why.
+ Beta Programs (Account): Settings > Account Info lists the Roblox betas your account is in.
+ Kids & Select Progress (Creator Hub): each experience in Creations shows a bar with its highly engaged players against the 250 Roblox needs before Kids and Select players can find it, or Eligible once it’s in.
+ Publishing Tier (Creator Hub): a badge next to Create Experience shows whether you can publish to Private, Trusted or Everyone, and hovering it lists what’s done and what’s left.
+ Store Card Dates (Creator Hub): every Creator Store result shows when it was last updated, and who updated it for group assets.
+ Asset Version (Creator Hub): Creator Store pages show how many times the creator has saved the asset.
```

**Improved**

```diff
~ Friends Today: Show All is a full-width button lined up with the list, with room before the next row.
~ 2017 Roblox Theme: Catalog, Sandbox and trade item cards are all the same height with room under the price, and the RoUtility Value shows in blue.
```

**Fixed**

```diff
- Friend History, Trade Calculator, Trade Ads and the other RoUtility menu links no longer show a second copy of the Friends or Trade counter after Roblox changed its counters.
- Trade Ads: profile pictures load again after routility.io changed how it sends them.
```

## 1.2.4 (November 15, 2026)

The 2017 Roblox Theme now looks like the real 2017 site, plus a steadier Trade button, tidier Owners rows and an Avatar page that fits smaller screens.

**New**

```diff
+ Recent Trades (Limited Values): limited item pages show how many times the item was traded lately, and a Recent Trades section under the Price Chart lists the latest trades, with who traded and what each item was worth at the time. See all trades opens every trade from the past week, month or all time.
+ Analyze Button (Trading): an Analyze button next to Decline on trades shows how each item in the trade has been traded lately, with who traded and what everything was worth.
+ Classics Row (2017 Roblox Theme): a Classics row at the top of the Games page with the big games from the Roblox front page of any year from 2012 to 2019, with their live player counts.
```

**Improved**

```diff
~ Menu Counters (Sidebar): the numbers next to Messages, Friends, Trade and Friend History are all the same size, lined up with room from the edge, and white again like Roblox used to show them. Pick Blue to keep Roblox’s new color.
~ Trades: the Proof button moved next to Decline with the other trade buttons, and the Try On buttons are gone from trades.
~ 2017 Roblox Theme: uses Source Sans like the real 2017 site, with lighter titles, blue See All buttons, the old R$ icon, game cards with Playing and rating on their own lines, and a top bar laid out like 2017.
~ 2017 Roblox Theme: a slimmer 2017-style sidebar that gives pages more room, with Quick Settings on one line each.
~ 2017 Roblox Theme: tidier Home, with a smaller greeting, a cleaner Friends row, wide game tiles that no longer grow on hover, and scroll arrows that only show when you point at a row.
~ 2017 Roblox Theme: the Chat & Party bar is blue like in 2017, Roblox items in the Catalog show By Roblox with the verified check, and the Robux menu uses the old R$ icon.
~ Trade Button on Profiles: a faded Trade button holds its spot while it loads, so the other buttons don’t jump.
~ Profile value pills explain themselves while they load when you hover them.
~ 2017 Roblox Theme no longer turns on the old sidebar by itself. There's an Old Sidebar switch right under the theme if you want it, synced with the one in the Sidebar tab.
```

**Fixed**

```diff
- 2017 Roblox Theme: Catalog price and creator filters are wide enough to type in, the Catalog search icon lines up, and Avatar items are white cards again without empty space.
- Profiles: with Classic Profile off, Currently Wearing no longer stretches past the page or shows items as giant boxes, Try Their Fit sits next to the heading, and the Trade button no longer squeezes the other buttons or pushes the … menu past the edge.
- Owners on item pages: rows are the same size as Resellers again instead of huge avatars and tall Trade buttons, and the Plus/Premium filter fits on one line.
- Avatar: the pinned left column can scroll to its bottom on smaller screens.
- 2017 Roblox Theme: fixed the cut-off Home greeting, empty space under game cards, the hidden Robux balance, the Holding Period info icon, Avatar item cards with empty boxes, and the spacing under Outfits and Friends on Classic Profile.
- 2017 Roblox Theme: the Classics row shows at the top of Games again when you have customized that page.
- 2017 Roblox Theme: the Roblox Plus link in the side menu just says Plus, so it fits on one line.
- Charts and Home no longer freeze for a few seconds while the game tiles load.
- Friend History, Trade Calculator, Trade Ads and the other RoUtility menu links no longer pick up a copy of the Friends or Trade counter.
- Experience pages no longer show Content failed to load for the description when Roblox says too many requests. RoUtility asks for a game's details once and waits a moment before trying again.
```

## 1.2.3 (November 14, 2026)

Join When Open keeps waiting in the background, a Trade button on profiles, profile backgrounds in Classic Profile, a bigger Sandbox Enlarge and a place picker for servers.

**New**

```diff
+ Subplace Picker (Servers): a dropdown in Server Regions to browse the servers of an experience’s other places, like a large-servers place. The Friends and Other Servers lists follow your pick, Play this place joins it, and your pick is remembered. (by @primary999)
+ Trade Button on Profiles (Trading): a Trade button next to Add Friend. When you can’t trade with someone it says Can’t Trade, and hovering it shows why.
+ Profile Background (Classic Profile Layout): when someone sets a profile background, it shows as a banner across the top with their avatar, and behind Currently Wearing.
```

**Improved**

```diff
~ Join When Open keeps checking in the background, even from another tab, works on subplaces, counts the wait in the tab title, and sends a notification when it joins or stops waiting.
~ Sandbox: Enlarge grows your avatar box right on the page, sharp in 2D and 3D, with your Outfit Worth and the items you’re wearing along the bottom.
~ Friend History: remove anyone you don’t want to see anymore with the ✕ on their row.
~ The RoUtility Bot shows in your Chat list even when chat is turned off in your Roblox privacy settings.
~ Settings: a few settings moved to the tab they belong in, like the Trade button under Trading, and there are new settings for Join When Open notifications and the Enlarge showcase.
~ The Sandbox button is gone from item and bundle pages to keep the buttons under the item tidy. Sandbox is still in the sidebar.
```

**Fixed**

```diff
- Classic Profile Layout: a changed About shows right away instead of the old one for a few minutes.
- Classic Profile Layout: the buttons no longer jump sideways for a moment while the mutual friends and communities load.
- Classic Profile Layout: other extensions’ icons next to a name, like Rotector’s, can be hovered and clicked again.
- Trades: No longer owned no longer flags bundles you have several copies of, and a trade is checked again after two minutes.
- Servers: the Join When Open button lines up with Join and the invite button.
```

## 1.2.2 (November 13, 2026)

Try anything in Sandbox from item pages, trades and profiles, keep Saved Fits, see your Outfit Worth, and item tags with the routility.io icons.

**New**

```diff
+ Try anything in Sandbox: a Sandbox button on item and bundle pages, Try On on each side of a trade, and Try Their Fit on profiles load those items or that whole outfit onto your Sandbox avatar.
+ Sandbox: Save Fit and Saved Fits keep outfits you put together, Undo steps back a change, Enlarge can download the picture, and Outfit Worth shows how many pieces you own and what the rest would cost.
+ Sandbox: the item search covers the whole Marketplace, the limited filters and sort sit right above the items, and an Outfit Worth total shows what your fit would be worth.
```

**Improved**

```diff
~ Item tags now use the same icons as routility.io: a gem for Rare, a golden gem for Ultra Rare and a warning sign for Projected.
~ Avatar: the Wearing panel shows your outfit's full Value as one big Outfit Worth total, with RAP and price underneath.
```

**Fixed**

```diff
- Trade search: trades that don't match no longer pop back in at the top after you open a matching trade.
- Classic Profile Layout: the creations section is now called Marketplace Items, since it shows hats, backgrounds and more, not just clothing.
```

## 1.2.1 (November 11, 2026)

Sandbox Mode to try on any Marketplace item, limiteds included, plus profile and tooltip fixes.

**New**

```diff
+ Sandbox (Avatar): a Sandbox page in the sidebar opens the avatar editor with every Marketplace item to try on, limiteds included, with the priciest classic limiteds first. Filter by limiteds, search, sort and enlarge the preview. Nothing you wear there is saved, and Exit Sandbox brings your real avatar back.
```

**Improved**

```diff
~ Click the magnifying glass in the search bar to open the Command Palette with whatever you typed.
```

**Fixed**

```diff
- Hover hints no longer stay stuck on screen when the panel under them refreshes.
- Edit in Studio no longer shows the game launch window as if you were joining a server.
- Classic Profile Layout: Send Robux and Customize name no longer overlap the pills under the name.
```

## 1.2.0 (November 10, 2026)

Command Palette, Wrapped, Friends Today, a Private Servers page, Join When Open and What Changed, plus Quick Play on Home.

**New**

```diff
+ Command Palette: press Ctrl K (Cmd K on a Mac) anywhere on Roblox to jump to a page, a friend or any RoUtility setting, and turn settings on or off right there.
+ Join When Open (Servers): full servers your friends are in get a button that waits for a spot and joins you the moment someone leaves.
+ What Changed (Experiences): an experience’s page shows what the developer changed in its description, name, server size or price since you last opened it.
+ Friends Today (Home): a row with what your friends did today, like who came online, what they started playing and for how long.
+ Wrapped: a picture of your year next to Your Most Played, with your hours played, top games, Robux spent, trades and friends.
+ Private Servers page: every private server you own or were invited to in one place, with when it renews, who is playing and a Join button.
+ Quick Play (Home): a Play button on experience tiles in Home and Charts, including Your Most Played, when you hover them, so you can join without opening the page.
```

**Improved**

```diff
~ Ignore All on friend requests asks you three times before ignoring everything.
~ An experience’s ⋯ menu has one Configure item instead of both Configure this Place and Configure this Experience.
~ Find Online Members moved from the community pills into the community’s ⋯ menu.
```

**Fixed**

```diff
- Skin color picker: the Brightness slider can be dragged again, not just clicked.
- Experience stats no longer run into each other when there are a lot of them. They wrap into two even rows.
- Badges on an experience’s page: the title and search line up with the badge list, and the title says Badges.
- Community pills keep their text on one line in smaller windows and wrap onto a second row instead.
- Proof pictures line up the RAP, Value and $ amounts under their icons, and the difference row no longer shows the $ twice.
```

## 1.1.9 (November 5, 2026)

Online Members, Friend History, Quick Play and server player filters, plus a Quick Setup fix for the store version.

**New**

```diff
+ Online Members (Communities): a Find Online Members button on community pages checks every member and lists who’s online, in a game or in Studio. Filter by In Game or a place ID, and join their server when Roblox shares it. (by @primary999)
+ Friend History (Friends): a page at roblox.com/friend-history with two columns, people who were added to your friends list and people who are no longer on it, saved on this device with when it happened. It uses Unfriend Detector’s checks and has its own link in the left menu, under Friends. (by @primary999)
+ Hide Download Button (General, on by default): hides the Download button Roblox is testing in the top bar. (by @primary999)
+ Quick Play (Search): a blue Play button next to the top game in the search bar, so you can join it without opening its page.
+ Filter Servers by Players (Servers): Min and Max boxes next to Sort By in a game’s Servers tab, to only show servers with that many players.
+ Owned Tag in the Marketplace: items and bundles you already have show an Owned tag while you browse.
```

**Improved**

```diff
~ Hover a Friends Since date on the friends list or a profile hover card to see the exact date and time. (by @reqonn)
~ Quick Settings can show who can trade with you and who can see your inventory, next to Joins and Online Status.
~ Friends Playing on Home shows how many people are in each game.
~ Classic Profile Layout: Two Columns shows the avatar items someone made, under their experiences.
~ Classic Names: the search bar says in Catalog and in Groups instead of in Marketplace and in Communities.
```

**Fixed**

```diff
- Classic Profile Layout: Join Game shows when Roblox hides its own Join button, like after you block someone, as long as Roblox still lets you join them. (by @reqonn)
- The RoUtility badge on friend cards is the same size as the icons next to it. (by @reqonn)
- Quick Setup in the store version: Just Values always showed as Current and the presets said Didn’t Apply. They apply again, and the RoUtility chat bot can answer questions about features again.
- Avatar editor: items you’re wearing that the editor didn’t mark show the check again, and clicking one takes it off.
- Recently Updated on Home: the Not Interested button sits inside the game card instead of half off it.
- Profile Collections show item names in your language instead of another one, like Vietnamese.
- Community pills that wrap onto two lines in a smaller window are no longer cut off.
```

## 1.1.8 (October 30, 2026)

RoUtility badges and friend request messages, plus server region and profile fixes.

**New**

```diff
+ 2017 Roblox Theme, phase 1 (Classic, off by default): the 2017 to 2019 Roblox look on Home, Games, game and item pages, the Catalog, Inventory, communities and profiles, with the blue top bar, old sidebar, Classic Names and green Play buttons. A Roblox Plus or custom theme keeps its colors. More pages come in the next phases.
+ Custom Name Badges (Fun): pick Verified, Roblox Plus, Premium and Roblox Admin for your own name. They show everywhere Roblox shows badges, in Roblox’s order, and start with the ones you really have. Roblox Admin also adds the Administrator badge to your Roblox Badges.
+ Classic Admin Badge (Classic, off by default): the old red R logo as the Roblox admin badge next to names, and the old Administrator badge in Roblox Badges.
+ Try In-Game: a button on item and bundle pages that opens Avatar Sandbox with the item already on your avatar, so you can see it in a real game before you buy.
+ Profile Notes: write a private note on anyone’s profile, like on Discord. Only you can see it, and once you verify with Roblox it’s backed up so it comes back on your other browsers. (by @reqonn)
+ Profile Pill Style: show the pills Combined, Separate or Minimal, with a preview in settings. Pills now go Value, RAP, then Price, and private inventories show a lock. (by @reqonn)
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
- Home: the friends row shows a loading placeholder until your friends are in, with Friends (0) and Add Friends if you have none, and the greeting shows your current avatar. (by @reqonn)
- Search: names in the search box are readable in light mode. (by @reqonn)
- Friends: going to the next page of a friends list shows each friend’s own Friends Since date, not the date from the page before. (by @reqonn)
- Classic Profile Layout: a friend’s new nickname shows right after you save it. (by @reqonn)
- Fun Mode: Fake Purchases and Fun Outfits are saved separately for each Roblox account, so what you fake buy on one no longer shows on another. (by @reqonn)
- Chat: the RoUtility bot window stays where it is when Roblox’s chat updates, so your chat windows don’t shuffle when a message comes in. (by @reqonn)
- The Shown via RoUtility label on hidden friends lists no longer draws on top of Roblox’s chat. (by @reqonn)
- Profiles with no description show that text at the same size as a normal bio.
- A startup error on some profiles is gone. (by @reqonn)
- Fun Mode: heads from bundles you bought, like Headless, now show on your headshot on Home and everywhere else, and replace the head you really wear.
- Fun Mode: limiteds you bought now add to the RAP, Value and USD under your name on your profile.
- Fun Mode: limited bundles you bought, like Dynamic Heads, show as Owned Items on the item page.
```

## 1.1.6 (October 20, 2026)

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

## 1.1.5 (October 16, 2026)

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

## 1.1.4 (October 15, 2026)

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

## 1.1.3 (October 15, 2026)

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

## 1.1.2 (October 14, 2026)

A round of fixes from friends' bug reports, and faster loading.

**Improved**

```diff
~ RoUtility's scripts are bundled and minified, so pages load faster.
```

**Fixed**

```diff
- Sixteen bugs reported by friends, across trades, profiles, the calculator and settings.
```

## 1.1.1 (October 14, 2026)

RoUtility speaks your language.

**New**

```diff
+ RoUtility in 16 languages, following your Roblox language by default.
+ Quick Setup: pick Just Values, Recommended or Everything in one click.
+ Outfit Rotator, Manage Badges with auto delete, and more Quick Settings rows.
```
