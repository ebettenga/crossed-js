import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Coins, Plus, PlayCircle } from 'lucide-react-native';
import { PageHeader } from '~/components/Header';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CoinPackageProps {
    coins: number;
    price: string;
    popular?: boolean;
    onPress: () => void;
}

const CoinPackage: React.FC<CoinPackageProps> = ({ coins, price, popular, onPress }) => (
    <TouchableOpacity 
        style={[
            styles.packageCard,
            popular && styles.popularCard
        ]}
        onPress={onPress}
    >
        {popular && (
            <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Most Popular</Text>
            </View>
        )}
        <View style={styles.packageContent}>
            <View style={styles.coinInfo}>
                <Coins size={24} color="#E6C200" />
                <Text style={styles.coinAmount}>{coins.toLocaleString()}</Text>
            </View>
            <Text style={styles.price}>{price}</Text>
            <View style={styles.buyButton}>
                <Plus size={20} color="white" />
                <Text style={styles.buyText}>Buy Now</Text>
            </View>
        </View>
    </TouchableOpacity>
);

const WatchAdButton: React.FC<{ onPress: () => void }> = ({ onPress }) => (
    <TouchableOpacity style={styles.adButton} onPress={onPress}>
        <View style={styles.adContent}>
            <PlayCircle size={24} color="#8B0000" />
            <View style={styles.adText}>
                <Text style={styles.adTitle}>Watch an Ad</Text>
                <Text style={styles.adReward}>Get <Coins size={14} color="#E6C200" /> 50 Free</Text>
            </View>
        </View>
        <Plus size={20} color="#8B0000" />
    </TouchableOpacity>
);

export default function Store() {
    const insets = useSafeAreaInsets();

    const handlePurchase = (coins: number, price: string) => {
        console.log(`Purchasing ${coins} coins for ${price}`);
        // Implement purchase logic
    };

    const handleWatchAd = () => {
        console.log('Watching ad for coins');
        // Implement ad logic
    };

    return (
        <View style={styles.container}>
            <PageHeader 
                username="John Doe"
                elo={1250}
                eloChange={25}
                gamesPlayed={42}
                avatarUrl="https://i.pravatar.cc/300"
                coins={100}
            />
            <ScrollView 
                style={styles.content}
                contentContainerStyle={[
                    styles.contentContainer,
                    { paddingBottom: insets.bottom + 90 }
                ]}
            >
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Get More Coins</Text>
                    <WatchAdButton onPress={handleWatchAd} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Coin Packages</Text>
                    <View style={styles.packages}>
                        <CoinPackage
                            coins={500}
                            price="$4.99"
                            onPress={() => handlePurchase(500, "$4.99")}
                        />
                        <CoinPackage
                            coins={1200}
                            price="$9.99"
                            popular
                            onPress={() => handlePurchase(1200, "$9.99")}
                        />
                        <CoinPackage
                            coins={2500}
                            price="$19.99"
                            onPress={() => handlePurchase(2500, "$19.99")}
                        />
                        <CoinPackage
                            coins={5000}
                            price="$39.99"
                            onPress={() => handlePurchase(5000, "$39.99")}
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2B2B2B',
        marginBottom: 12,
        fontFamily: 'Times New Roman',
    },
    packages: {
        gap: 12,
    },
    packageCard: {
        backgroundColor: '#F8F8F5',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        position: 'relative',
        overflow: 'hidden',
    },
    popularCard: {
        borderColor: '#8B0000',
        borderWidth: 2,
    },
    popularBadge: {
        position: 'absolute',
        top: 20,
        right: -42,
        backgroundColor: '#8B0000',
        paddingHorizontal: 40,
        paddingVertical: 4,
        transform: [{ rotate: '45deg' }],
    },
    popularText: {
        color: 'white',
        fontSize: 12,
        fontFamily: 'Times New Roman',
        marginTop: 2,
    },
    packageContent: {
        alignItems: 'center',
        gap: 8,
    },
    coinInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    coinAmount: {
        fontSize: 24,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    price: {
        fontSize: 20,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
    buyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8B0000',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
        marginTop: 8,
    },
    buyText: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Times New Roman',
    },
    adButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF5F5',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    adContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    adText: {
        gap: 2,
    },
    adTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2B2B2B',
        fontFamily: 'Times New Roman',
    },
    adReward: {
        fontSize: 14,
        color: '#666666',
        fontFamily: 'Times New Roman',
    },
}); 