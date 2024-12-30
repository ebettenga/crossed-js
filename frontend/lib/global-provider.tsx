import { createContext, ReactNode, useContext, useEffect } from "react";
import { QueryObserverResult, RefetchOptions, useQuery } from "@tanstack/react-query";
import { get } from "@/hooks/api";
import * as DevClient from 'expo-dev-client';

interface User {
    $id: string;
    name: string;
    email: string;
    avatar: string;
    refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<any, Error>>;
}

interface GlobalContextType {
    isLoggedIn: boolean;
    user: User | null;
    loading: boolean;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const {
        data: user,
        isLoading: loading,
        refetch
    } = useQuery({
        queryKey: ["me"],
        queryFn: async () => {
            const data = await get("/me");
            return data;
        }
    });

    const isLoggedIn = !!user;

    useEffect(() => {
        if (__DEV__) {
            DevClient.registerDevMenuItems([
                {
                    name: "Debug User Session",
                    callback: () => {
                        console.log("Current user:", user);
                    },
                    shouldCollapse: false,
                }
            ]);
        }
    }, [user]);

    return (
        <GlobalContext.Provider value={{
            isLoggedIn,
            user,
            loading,
            // @ts-ignore
            refetch,
        }}>
            {children}
        </GlobalContext.Provider>
    )
}

export const useGlobalContext = (): GlobalContextType => {
    const context = useContext(GlobalContext);

    if (!context) {
        throw new Error('useGlobalContext must be used within a GlobalProvider');
    }

    return context;
}

export default GlobalProvider;