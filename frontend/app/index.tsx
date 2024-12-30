import 'react-native-reanimated';
import React, { useState } from 'react'
import { SafeAreaView } from "react-native-safe-area-context";
import { useMessages } from '~/hooks/socket';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { Input } from '~/components/ui/input';
import { useSignIn } from '~/hooks/users';
import { GameScreen } from '~/screens/GameScreen';
import { useRouter } from 'expo-router';

export default function Index() {
    const router = useRouter();
    const signInMutation = useSignIn();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [text, setText] = useState('');
    const handleSubmit = () => {
        signInMutation.mutate({ email, password });
    };
    // const { messages, send } = useMessages();
    return (
        <SafeAreaView>
            <Button onPress={() => { router.push('/game') }}><Text>Game</Text></Button>
            <Button onPress={() => { router.push('./home') }}><Text>Game</Text></Button>
            {/* <GameScreen />   */}

        </SafeAreaView>
    )
}
