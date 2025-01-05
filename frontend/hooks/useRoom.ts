export interface Player {
    id: number;
    username: string;
    avatarUrl?: string;
    created_at: string;
    email: string;
    roles: string[];
    eloRating: number;
    winStreak: number;
    gamesPlayed: number;
    isPremium: boolean;
    premiumExpiresAt: string | null;
} 