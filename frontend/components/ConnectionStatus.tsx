import React from 'react';
import { View } from 'react-native';
import { useSocket } from '../hooks/socket';
import { Wifi, WifiOff } from 'lucide-react-native';

interface ConnectionStatusProps {
    compact?: boolean;
}

const ConnectionStatus = ({ compact = false }: ConnectionStatusProps) => {
    const { isConnected, isConnecting, connectionQuality } = useSocket();

    if (compact) {
        return (
            <View>
                {isConnected ? (
                    <Wifi
                        size={16}
                        color={connectionQuality === 'poor' ? '#F97316' : '#22C55E'}
                    />
                ) : (
                    <WifiOff size={16} color="#EF4444" />
                )}
            </View>
        );
    }

    return (
        <View className={`p-2 rounded-full ${
            !isConnected ? 'bg-red-500' :
            isConnecting ? 'bg-yellow-500' :
            connectionQuality === 'poor' ? 'bg-orange-500' : 'bg-green-500'
        }`}>
            {isConnected ? (
                <Wifi
                    size={20}
                    color="#FFFFFF"
                />
            ) : (
                <WifiOff size={20} color="#FFFFFF" />
            )}
        </View>
    );
};

export default ConnectionStatus;
