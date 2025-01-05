import { createContext, ReactNode, useContext } from "react";
import { User, useUser } from "~/hooks/users";

interface GlobalContextType {
    isLoggedIn: boolean;
    user: User | null;
    loading: boolean;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const { data: user, isLoading: loading } = useUser();

    const isLoggedIn = !!user;

    // useEffect(() => {
    //     if (__DEV__) {
    //         DevClient.registerDevMenuItems([
    //             {
    //                 name: "Debug User Session",
    //                 callback: () => {
    //                     console.log("Current user:", user);
    //                 },
    //                 shouldCollapse: false,
    //             }
    //         ]);
    //     }
    // }, [user]);

    return (
        <GlobalContext.Provider value={{
            isLoggedIn,
            user: user || null,
            loading,
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