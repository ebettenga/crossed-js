# Crossed Mobile App Implementation

## Components to Build

### 1. Authentication & User Management
- [ ] `components/auth/LoginScreen.tsx` - Login form with email/password
- [ ] `components/auth/RegisterScreen.tsx` - Registration form
- [ ] `components/auth/AuthContext.tsx` - Auth state management
- [ ] `components/auth/AuthService.ts` - API calls for auth

### 2. Game Room Management
- [ ] `components/room/RoomList.tsx` - List of available rooms
- [ ] `components/room/RoomCreation.tsx` - Create new room with difficulty
- [ ] `components/room/RoomJoin.tsx` - Join existing room
- [ ] `components/room/RoomContext.tsx` - Room state management

### 3. Crossword Game Board
- [ ] `components/game/CrosswordBoard.tsx` - Main game board component
- [ ] `components/game/CrosswordCell.tsx` - Individual cell component
- [ ] `components/game/ScoreBoard.tsx` - Display current scores
- [ ] `components/game/GameControls.tsx` - Game controls (submit, etc.)

### 4. User Stats & Profile
- [ ] `components/profile/ProfileScreen.tsx` - User profile view
- [ ] `components/profile/StatsDisplay.tsx` - Show ELO, wins, losses
- [ ] `components/profile/LeaderBoard.tsx` - Global rankings

### 5. Navigation
- [ ] `navigation/AppNavigator.tsx` - Main navigation setup
- [ ] `navigation/AuthNavigator.tsx` - Auth flow navigation
- [ ] `navigation/GameNavigator.tsx` - Game flow navigation

### 6. WebSocket Integration
- [ ] `services/SocketService.ts` - WebSocket connection management
- [ ] `services/GameService.ts` - Game-related API calls

### 7. State Management
- [ ] `store/GameStore.ts` - Game state management
- [ ] `store/UserStore.ts` - User state management
- [ ] `store/RoomStore.ts` - Room state management

### 8. Types
- [ ] `types/Game.ts` - Game-related types
- [ ] `types/Room.ts` - Room-related types
- [ ] `types/User.ts` - User-related types

## Key Implementation Notes

### React Native Specific Considerations

1. **Layout & Styling**
   - Replace HTML elements with React Native components
     - `div` → `View`
     - `p`, `span` → `Text`
   - Use `StyleSheet` for styling
   - Handle different screen sizes
   - Implement touch interactions

2. **Navigation**
   - Implement React Navigation
   - Handle native navigation gestures
   - Implement proper back button behavior






   a list of items designed to be easy things that we need added


### Backend

- a command (edit-user) that let's use change user data, specifically passwords
- a plan to validate incoming bodies
- make an unauthorized error and replace all the crappy ones
- add coins to user table
- make tests more kick ass
- add migrations
- have a room have a mode column
- have the room take more than 2 people
- fill out remaining stats in GameStats view
- make a friends table
- make elo system handle calculating games with more than two players
- make a profile table for a user that has aditional infromation like avatar
- setup stripe to store stripe ids in backend and webhook to handle payments
- create way to see how much elo a player has changed in a amount of time (1 day, 1 week, etc...)
- add way to be able to "lock" a square for a duration in exchange for some coins (maximium 2 locks per game)

### Frontend

- make settings page
- make payment options page
- set up ad network






### Next Goals

get a game played on the mobile app
    - connect to game
    - be able to guess letters and see them show up
    - get a summary modal when a game finished event comes through
