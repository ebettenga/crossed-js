# Crossed Mobile App Implementation





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
- [make payment options page](https://superwall.com/blog/integrating-superwall-in-your-indie-react-native-app)
- set up ad network
- Add a Game complete animation/ modal



### Next Goals

get a game played on the mobile app
    - connect to game
    - be able to guess letters and see them show up
    - get a summary modal when a game finished event comes through


Add Toasts to front end(i.e. friend added, etc.)
Get a summary modal with stats when the game is finished that redirects to home()
Make pages responsive for both Mobile and web
Make a Tournment Style Game
Dark mode
Lose variables in front end to variables(AI Work)
Have Avatar photos show up in the game screen visable others
Get Superwall(i.e. Paywall) integrated into the app
Create a design system for the App
Getting Socal Media Pages up and running
Get tests written and working(Have AI write them)
Configure Backend so it can run schedulable Jobs(async)
Be able to send Emails(reset password,marketingemails,etc.)
Be able to make a custom game(i.e. set number of players)
Add Audio sound effects to the game
Create Mapping service so we don't send confidential data(i.e. don't send user password, don't send game answers)
Add loading indicators to the frontend
Deploy the backend to external provider(Railway)
Get iOS working
Match People based on Elo ranking
Add Animations for correct and incorrect guesses
