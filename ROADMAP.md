# Roadmap

Where Board goes from here. Each phase has one goal and a way to tell if it worked.

## ✅ Phase 1 — Polish (done)

Undo/redo, multi-select, snapping with guides, duplicate and copy/paste, welcome cards, automatic snapshots.

---

## Phase 2 — Ship it

**Goal:** anyone can install Board in one click.
**Worked if:** 100 installs in the first two weeks, and some of them still open it a week later.

### Chrome Web Store
- [ ] Developer account ($5 one-time) at the Chrome Web Store dashboard
- [ ] Privacy policy page (short: everything stays in your browser; Chrome sync is optional) — host on GitHub Pages
- [ ] Store listing: name, 1-line summary, description, category (Productivity)
- [ ] Assets: 128px icon (have it), 5 screenshots at 1280×800, small promo tile 440×280
- [ ] Explain each permission for review: `storage`, `unlimitedStorage` (images), `alarms` + `notifications` (reminders), `favicon` (link icons)
- [ ] Script to zip `newtab/` for upload; bump `version` in `manifest.json` each release
- [ ] Note: the Web Store gives the extension its own ID, so the `key` in `manifest.json` gets replaced by the store's key — sync then follows the store version

### Landing page
- [ ] One page: headline, 20-second demo video/GIF, "Add to Chrome" button, 3 feature blocks, footer link to GitHub
- [ ] Host on GitHub Pages or Vercel with a simple domain

### Launch
- [ ] Product Hunt launch (tagline idea: *"Your new tab, but it's a whole world"*), first comment telling the story
- [ ] Post on X / Reddit (r/chrome_extensions, r/productivity, r/SideProject) with the demo GIF
- [ ] Feedback link inside the ⋯ menu (GitHub issues or a simple form)

---

## Phase 3 — Make it a habit

**Goal:** people open Board on purpose, not just because it's the new tab.
**Worked if:** most active users add a card at least a few times a week.

Ordered by impact vs. effort:

| # | Feature | Why | Effort |
|---|---|---|---|
| 1 | **"Send to Board" right-click menu** on any website (text, images, links → cards) | Turns browsing into collecting — the main habit loop | S |
| 2 | **Templates** — weekly planner, launch checklist, study board, mood board | Empty boards are scary; templates show what's possible | S |
| 3 | **Markdown in notes** (bold, lists, links, headings) | Notes get used for real writing | M |
| 4 | **Live cards** — weather, today's calendar, GitHub stars, Product Hunt votes, crypto prices | A reason to glance at the board every time | M |
| 5 | **Tags + filter** (and color filter) | Busy boards stay findable | S |
| 6 | **Stacks** — drop cards on each other to group them into a pile | Keeps big boards tidy | M |
| 7 | **Card resize snapping + "tidy up" button** that arranges selected cards in a grid | Neat boards without effort | S |
| 8 | **Export a board as an image** | Easy sharing → free marketing | S |

Smaller fixes worth doing along the way:
- Keyboard-only use: Tab between cards, arrow keys to nudge selected cards
- Light theme option
- Performance check with 500+ cards and many images

---

## Phase 4 — "My World": public boards

**Goal:** turn Board from a private tool into something people share.
**Worked if:** shared pages bring in new installs on their own.

The idea: publish any board as a public page — `board.so/yourname` — that visitors can explore (pan, zoom, click links) but not edit. Think link-in-bio, but a canvas.

- [ ] Accounts (sign in with Google — matches the Chrome audience)
- [ ] Backend for published boards (Supabase or Firebase: boards as JSON + image storage)
- [ ] "Publish this board" button in the extension → read-only web viewer
- [ ] Viewer page reuses the same card code (`js/cards/`) in read-only mode — the modular structure pays off here
- [ ] Profile basics: name, avatar, custom URL
- [ ] **Tip card** wired to Buy me Tokens, so builders get supported from their page
- [ ] Live cards from Phase 3 make public pages feel alive ("build in public" dashboards)
- [ ] "Made with Board" link on every public page → installs

Money, once there's usage: free for one public board; paid tier for custom domains, more boards, analytics (who viewed, which cards got clicks), and full sync with images.

---

## Ideas parked for later
- Real-time collaboration on a board (big build; only if Phase 4 shows demand)
- AI: summarize a pasted link into a card, auto-group related cards
- Mobile companion for viewing boards on the go
- Onchain cards (wallet, token prices, NFTs) for a crypto-native version
