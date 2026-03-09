import { Bet, SorteoResult } from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
}

export const apiClient = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: any) => request<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
    }),
};

// Satisfy linter for unused types if they are only used as generics elsewhere
export type { Bet, SorteoResult };
