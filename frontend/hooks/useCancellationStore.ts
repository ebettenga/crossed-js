import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

type CancellationStage = "idle" | "queued" | "redirecting";

interface CancellationState {
  cancelledRoomId: number | null;
  message: string | null;
  stage: CancellationStage;
}

interface CancellationContextValue {
  state: CancellationState;
  queueCancellation: (roomId: number | null, message?: string | null) => void;
  startRedirect: (roomId: number) => void;
  completeCancellation: (roomId?: number) => void;
}

const CancellationContext = createContext<CancellationContextValue | undefined>(
  undefined,
);

const initialState: CancellationState = {
  cancelledRoomId: null,
  message: null,
  stage: "idle",
};

export const CancellationProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<CancellationState>(initialState);

  const queueCancellation = useCallback(
    (roomId: number | null, message?: string | null) => {
      if (roomId === null || roomId === undefined) {
        return;
      }

      setState((current) => {
        if (current.cancelledRoomId === roomId) {
          const stage = current.stage === "idle" ? "queued" : current.stage;
          return {
            cancelledRoomId: roomId,
            message: message ?? current.message,
            stage,
          };
        }

        return {
          cancelledRoomId: roomId,
          message: message ?? null,
          stage: "queued",
        };
      });
    },
    [],
  );

  const startRedirect = useCallback((roomId: number) => {
    setState((current) =>
      current.cancelledRoomId === roomId
        ? { ...current, stage: "redirecting" }
        : current
    );
  }, []);

  const completeCancellation = useCallback((roomId?: number) => {
    setState((current) => {
      if (roomId !== undefined && current.cancelledRoomId !== roomId) {
        return current;
      }
      return initialState;
    });
  }, []);

  return React.createElement(
    CancellationContext.Provider,
    {
      value: {
        state,
        queueCancellation,
        startRedirect,
        completeCancellation,
      },
    },
    children,
  );
};

export const useCancellationStore = () => {
  const context = useContext(CancellationContext);
  if (!context) {
    throw new Error(
      "useCancellationStore must be used within a CancellationProvider",
    );
  }
  return context;
};
