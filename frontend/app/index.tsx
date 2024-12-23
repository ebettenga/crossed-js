import React, { useState } from 'react'
import { SafeAreaView } from "react-native-safe-area-context";
import { useMessages } from '~/hooks/socket';
import { Button } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { storage } from '~/hooks/api';
import { Input } from '~/components/ui/input';
import { useSignIn } from '~/hooks/users';

export default () => {
    const signInMutation = useSignIn();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [text, setText] = useState('');
    const handleSubmit = () => {
        signInMutation.mutate({ email, password });
    };
    const { messages, send } = useMessages();
    return (
        <SafeAreaView>

            <Input
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
            />
            <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button onPress={handleSubmit}>
                <Text>Sign In</Text>
            </Button>
            <Input
                placeholder="Type a message"
                value={text}
                onChangeText={setText}
            />
            <Text>Messages:</Text>
            <Button onPress={() => { send(text); setText(""); }}><Text>Submit</Text></Button>
            {messages.map((message, index) => (
                <Text className='px-4 py-2' key={index}>{message}</Text>
            ))}
        </SafeAreaView>
    )
};
