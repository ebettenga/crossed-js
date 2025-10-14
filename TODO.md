# TODO List


## Bugs

1. fix color issues on top and bottom phone bar on production release ( google drive image shows this)
2. fix spacing issues on production release (can't see question sometimes)
3. make scroll on game summary easier
4. make create account button more obvious (next to sign in instead?)
5. make signup page scroll up past text input (you have to leave the input to click into password atm)
6. tabs bar doesn't sit at bottom of screen properly (google drive image)
7. remove bottom phone bar if possible
8. top scores game summary modal needs a rework
9. sounds get cutoff when selecting a game (play enitre sound, then navigate or something)

## Features

1. tests
2. tests ci



AI Generated Ideas:

## 1v1, 2v2, free-for-all specific

- [ ] Show Head-to-head deltas (1v1): text summary of first lead, largest lead, final margin.

## Time-trial specific enhancements

- [ ] Highlight and pin "Your row" in leaderboard (append outside top N if needed) using useTimeTrialLeaderboard().
- [ ] Show "This run" summary; later show "Personal Best" once PB endpoint exists.
- [ ] Show Pace and split insights from correctGuessDetails timestamps: avg sec/letter, fastest 30s streak, longest gap.
- [ ] Show Percentile language ("Top NN% this room") when backend exposes aggregate counts.

## Ratings UX improvements

- [ ] After submit (when backend supports), show community aggregates: "Quality 4.3/5; Difficulty: 63% 'Just Right'".

## Calls-to-action that drive retention

- [ ] Rematch variants (1v1/2v2/FFA); for time-trial, "Run again" (fresh seed if supported).
- [ ] New puzzle with similar difficulty CTA based on room.difficulty (e.g., "Next puzzle (Hard)").
- [ ] Share result: share sheet (score, time, rating, puzzle title) and deep link to spectate/play.
- [ ] Save to favorites: bookmark this crossword ID for later replay/share.
