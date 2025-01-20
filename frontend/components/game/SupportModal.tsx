import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { SupportContent } from '../support/SupportContent';
import { useKeyboardVisible } from '~/hooks/useKeyboardVisible';
import { cn } from '~/lib/utils';

interface SupportModalProps {
    isVisible: boolean;
    onClose: () => void;
    onReport: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({
    isVisible,
    onClose,
}) => {
    const isKeyboardVisible = useKeyboardVisible();

    return (
        <Dialog style={{ borderRadius: 4 }} open={isVisible} onOpenChange={onClose}>
            <DialogContent
                className={cn(
                    "mx-4 my-safe-or-44",
                    isKeyboardVisible && "h-[80%]"
                )}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <SupportContent
                        className="rounded-md"
                        onClose={onClose}
                        initialType="support"
                    />
                </KeyboardAvoidingView>
            </DialogContent>
        </Dialog>
    );
};
