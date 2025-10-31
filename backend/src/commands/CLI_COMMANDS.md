# CLI Commands

## start-game

Start a new game between two players with an optional pre-filled board.

### Usage

```bash
yarn start-game -p1 <player1_id> -p2 <player2_id> [options]
```

Or using the commands script directly:
```bash
yarn commands start-game -p1 <player1_id> -p2 <player2_id> [options]
```

### Required Options

- `-p1, --player1 <number>` - First player ID
- `-p2, --player2 <number>` - Second player ID

### Optional Options

- `-d, --difficulty <string>` - Difficulty level: `easy`, `medium`, or `hard` (default: `easy`)
- `-f, --fill <number>` - Percentage of squares to pre-fill (0-100) (default: `0`)
- `-t, --timer` - Start the auto-reveal pressure system (default: `false`)

### Examples

1. **Start a basic game between two players:**
   ```bash
   yarn start-game -p1 1 -p2 2
   ```

2. **Start a medium difficulty game:**
   ```bash
   yarn start-game -p1 1 -p2 2 -d medium
   ```

3. **Start a game with 50% of the board pre-filled:**
   ```bash
   yarn start-game -p1 1 -p2 2 -f 50
   ```

4. **Start a hard game with 25% pre-filled:**
   ```bash
   yarn start-game -p1 1 -p2 2 -d hard -f 25
   ```

5. **Start a game with the auto-reveal system enabled:**
   ```bash
   yarn start-game -p1 1 -p2 2 -t
   ```

6. **Start a game with pre-fill and the auto-reveal system:**
   ```bash
   yarn start-game -p1 1 -p2 2 -d medium -f 30 -t
   ```

### How It Works

1. **Validates player IDs** - Ensures both players exist in the database
2. **Validates fill percentage** - Must be between 0 and 100
3. **Selects a crossword** - Randomly selects a crossword matching the difficulty level
4. **Creates the game room** - Sets up a 1v1 game with both players
5. **Pre-fills squares** - If a fill percentage is specified:
   - Calculates how many squares to fill based on the percentage
   - Randomly selects that many unfilled squares
   - Fills them with the correct letters from the crossword solution
6. **Starts the game** - Sets the game status to "playing" immediately

### Output

The command will output:
- Room ID
- Player usernames and IDs
- Difficulty level
- Crossword title
- Grid size
- Pre-fill percentage
- Game status

Example output:
```
Pre-filled 45 out of 90 squares (50%)

✓ Game created successfully!
  Room ID: 123
  Players: alice (ID: 1) vs bob (ID: 2)
  Difficulty: medium
  Crossword: NYT Wednesday Puzzle
  Grid Size: 15x15
  Pre-filled: 50%
  Status: playing
```

### Notes

- The game is created with status "playing" so players can start immediately
- Pre-filled squares are randomly selected from all available unfilled squares
- Black squares (marked with `.` in the grid) are never filled
- The pre-fill feature is useful for testing, debugging, or creating practice games
- **Auto-Reveal System**: When enabled with `-t`, Crossed will begin revealing letters on a dynamic cadence when players stay idle, ramping up pressure as the board fills in (initial delay defaults to 5 seconds).
- The auto-reveal system is useful for production games to ensure momentum and prevent games from stalling indefinitely.
- Without the timer flag, games will remain active until manually completed or forfeited
