import React from 'react';
import Toast, { BaseToast, ErrorToast, ToastType } from 'react-native-toast-message';
import { createContext, useContext } from 'react';
import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react-native';
import { View } from 'react-native';

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const toastConfig = {
    success: (props: any) => (
        <BaseToast
            {...props}
            renderLeadingIcon={() => (
                <View style={{ marginLeft: 15, justifyContent: 'center' }}>
                    <CheckCircle2 size={24} color="#22C55E" />
                </View>
            )}
            style={{ borderLeftColor: '#22C55E' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15 }}
        />
    ),
    error: (props: any) => (
        <ErrorToast
            {...props}
            renderLeadingIcon={() => (
                <View style={{ marginLeft: 15, justifyContent: 'center' }}>
                    <XCircle size={24} color="#EF4444" />
                </View>
            )}
            style={{ borderLeftColor: '#EF4444' }}
            text1Style={{ fontSize: 15 }}
        />
    ),
    info: (props: any) => (
        <BaseToast
            {...props}
            renderLeadingIcon={() => (
                <View style={{ marginLeft: 15, justifyContent: 'center' }}>
                    <Info size={24} color="#3B82F6" />
                </View>
            )}
            style={{ borderLeftColor: '#3B82F6' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15 }}
        />
    ),
    warn: (props: any) => (
        <BaseToast
            {...props}
            renderLeadingIcon={() => (
                <View style={{ marginLeft: 15, justifyContent: 'center' }}>
                    <AlertCircle size={24} color="#EAB308" />
                </View>
            )}
            style={{ borderLeftColor: '#EAB308' }}
            contentContainerStyle={{ paddingHorizontal: 15 }}
            text1Style={{ fontSize: 15 }}
        />
    ),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const showToast = (message: string, type: ToastType = 'info', duration = 3000) => {
        Toast.show({
            type: type,
            text1: message,
            visibilityTime: duration,
            position: 'bottom',
        });
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Toast config={toastConfig} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
