export interface User {
    id: number;
    username: string;
    created_at: string;
    email: string;
    roles: string[];
    description: string;
    eloRating: number;
    gamesWon: number;
    gamesLost: number;
    guessAccuracy: number;
    winRate: number;
} 