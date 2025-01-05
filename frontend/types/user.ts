export interface User {
    id: number;
    username: string;
    avatarUrl?: string;
    email: string;
    roles: string[];
    created_at: string;
    eloRating: number;
    winStreak: number;
    gamesPlayed: number;
    isPremium: boolean;
    premiumExpiresAt: string | null;
} 