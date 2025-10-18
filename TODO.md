# TODO List


## Bugs

1. tabs bar doesn't sit at bottom of screen properly (google drive image)
2. when user has multiple games, it goes into a infinite loading screen
3. on the finished page in light mode, can't see icons and some text

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
