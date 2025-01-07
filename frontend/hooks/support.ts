import { useMutation, useQuery } from '@tanstack/react-query';
import { get, post } from './api';


export type FeedbackType = 'support' | 'suggestion';

export interface Support {
    id: number;
    type: FeedbackType;
    comment: string;
    created_at: string;
}

interface CreateSupportParams {
    type: FeedbackType;
    comment: string;
}

export function useSupport() {
    return useQuery<Support[]>({
        queryKey: ['support', 'me'],
        queryFn: async () => {
            const response = await get<Support[]>('/support/me');
            return response;
        }
    });
}

export function useCreateSupport() {
    return useMutation({
        mutationFn: async (data: CreateSupportParams) => {
            const response = await post('/support', data);
            return response;
        }
    });
}
