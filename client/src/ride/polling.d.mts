export function createPoller<T>(options: {
  load: () => Promise<T>;
  onData: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
  delay?: number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}): { start(): Promise<void>; stop(): void; refresh(): Promise<void>; setDelay(delay: number): void };
