# Squad Plan

How Board grows from a private new tab into something friends share. This sits alongside `ROADMAP.md` (ship it, habits, public boards). Each step ships on its own and none needs the next one, so we add them gradually.

## Where we are

Board is a Chrome new-tab extension: about 2,400 lines of plain JS and no backend.

- Infinite canvas with drag, zoom, snapping, multi-select, undo/redo
- Cards: note, checklist, link, image, countdown, embed
- Connection lines, reminders with notifications, multiple boards, search
- Snapshots, file backups, Chrome sync

**Sync today:** boards are saved to `chrome.storage.sync` (`newtab/js/sync.js`), so they follow whoever is signed into Chrome with sync on. That covers your own boards across your own computers. It can't share anything with friends, and it is limited in size (about 100 KB in total), so images aren't included.

## The big idea: a social board

You and your friends join a group. Everyone's todo list shows up on one giant shared board, with each person's name and tasks, so you can see who's getting things done and who's slacking.

- Sign in with Google, create a group, friends join with an invite link
- Each person edits their own todo card; everyone else sees it read-only
- A shared squad board shows every member's list side by side, live
- Progress bars, tasks done today, streaks, a leaderboard
- A gentle nudge button for whoever is falling behind

**Needs a backend.** Firebase is the easiest fit: Google sign-in, a realtime database, and a free tier that is plenty for a group of friends. Extensions can sign in with Google through `chrome.identity`, and the fixed `key` in `manifest.json` keeps the extension ID stable, which makes that setup easier.

## Steps

### 1. No backend, quick wins
- [ ] Right-click "Send to Board" on any site (text, images, links become cards)
- [ ] Templates (weekly planner, study board, launch checklist)
- [ ] Export a board as an image
- [ ] Tags and filter

### 2. Cards that look alive
- [ ] Streak and "done today" count on checklists (groundwork for the squad board)
- [ ] Pomodoro / focus timer card
- [ ] Google Calendar card

### 3. Accounts
- [ ] Create a free Firebase project
- [ ] Google sign-in through `chrome.identity`
- [ ] Profile: name and photo
- [ ] Boards stay local; nothing else changes yet

### 4. Squad board
- [ ] Groups with invite links
- [ ] Each member's todo list on one shared board, updating live
- [ ] Progress bars and a leaderboard
- [ ] Nudge button

### 5. Link Paddy
- [ ] Find out what Link Paddy is (own app or someone else's, API or not, same friends or different)
- [ ] A "friends' links" card that shows links shared by Link Paddy friends
- [ ] A share-to-friend button on link cards

### 6. Public and shareable boards
- [ ] Publish a board as a read-only page (see Phase 4 in `ROADMAP.md`)

## Open questions

- **Link Paddy:** what is it, and does it have an API or login we can connect to?
- **Backend:** okay to create a Firebase project under your Google login?
- **Privacy:** before the squad board ships, we need a privacy policy and a way for a user to delete their account and data. Chrome Web Store review gets stricter once we collect accounts.

## First up

Step 1, plus the checklist streaks from step 2, since the squad board depends on them.
