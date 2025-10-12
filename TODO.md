# TODO List


## Bugs

1. on the stats page, in recent games, the correct and incorrect numbers are often the same number for some reason


## Features

1. logging
2. tests
3. change diffultly selector on home page to look more like challenge modal






## High-impact additions for all game types

- [ ] Show Match outcome summary: margin of victory/defeat; aggregate team scores for 2v2.

- [ ] Show Elo change using gameStats.eloAtGame and eloChange with green/red styling; fallback to user.eloRating with "rating unchanged" when eloChange is missing.

- [ ] Show Accuracy and mistakes: compute accuracy = correctGuesses / (correctGuesses + incorrectGuesses); display "Accuracy: NN% (X correct, Y mistakes)".

- [ ] Show Contribution share: compute user's correctGuesses / sum(correctGuesses of all players) and display contribution%.

- [ ] Show Completion metrics: coverage percent of solved vs total non-black squares using board and found letters ("Grid solved: NN%").

## 1v1, 2v2, free-for-all specific

- [ ] Show MVP and leaderboard: rank by score; MVP tag; per-team totals and within-team ranking; mini table: Name | Score | Accuracy | Elo Δ.
- [ ] Show Teammate synergy (2v2): streak assist heuristic from back-to-back corrects within a short window.
- [ ] Show Head-to-head deltas (1v1): text summary of first lead, largest lead, final margin.

## Time-trial specific enhancements

- [ ] Highlight and pin "Your row" in leaderboard (append outside top N if needed) using useTimeTrialLeaderboard().
- [ ] Show "This run" summary; later show "Personal Best" once PB endpoint exists.
- [ ] Show Pace and split insights from correctGuessDetails timestamps: avg sec/letter, fastest 30s streak, longest gap.
- [ ] Show Percentile language ("Top NN% this room") when backend exposes aggregate counts.

## Crossword-centric insights

- [ ] Show themed note: creator/author bio line; if difficulty is "hard", include one-line explanation when community-average difficulty is available.

## Ratings UX improvements

- [ ] After submit (when backend supports), show community aggregates: "Quality 4.3/5; Difficulty: 63% 'Just Right'".

## Calls-to-action that drive retention

- [ ] Rematch variants (1v1/2v2/FFA); for time-trial, "Run again" (fresh seed if supported).
- [ ] New puzzle with similar difficulty CTA based on room.difficulty (e.g., "Next puzzle (Hard)").
- [ ] Share result: share sheet (score, time, rating, puzzle title) and deep link to spectate/play.
- [ ] Save to favorites: bookmark this crossword ID for later replay/share.
