import { useMutation } from '@tanstack/react-query';
import { post } from './api';
import { DifficultyRating } from '~/types/crossword';
import { showToast } from '~/components/shared/Toast';

export const useRateDifficulty = () => {
    return useMutation({
        mutationFn: async ({ crosswordId, rating }: { crosswordId: number; rating: DifficultyRating }) => {
            return await post(`/crosswords/${crosswordId}/rate-difficulty`, { rating });
        },
    });
};

export const useRateQuality = () => {
    return useMutation({
        mutationFn: async ({ crosswordId, rating }: { crosswordId: number; rating: 1 | 2 | 3 | 4 | 5 }) => {
            if (rating < 1 || rating > 5) {
                throw new Error("Rating must be between 1 and 5");
            }
            return await post(`/crosswords/${crosswordId}/rate-quality`, { rating });
        },
        onSuccess: () => {
            showToast('success', 'Rating submitted successfully');
        }
    });
};
