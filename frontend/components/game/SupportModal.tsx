import React from 'react';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { SupportContent } from '../support/SupportContent';

interface SupportModalProps {
    isVisible: boolean;
    onClose: () => void;
    onReport: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({
    isVisible,
    onClose,
}) => {
    return (
        <Dialog style={{ borderRadius: 4 }} open={isVisible} onOpenChange={onClose}>
            <DialogContent className="mx-4 my-safe-or-32">
                <SupportContent
                    onClose={onClose}
                    initialType="support"
                />
            </DialogContent>
        </Dialog>
    );
};
