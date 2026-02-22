const CELEBRATION_EXCLAMATIONS = [
  'Woo-hoo! Loop complete!',
  'Yessss! Nailed it.',
  'Plan came together perfectly!',
  'Boom! Another package locked.',
  'Victory lap: approved!'
] as const;

export function randomCelebrationExclamation(): string {
  const index = Math.floor(Math.random() * CELEBRATION_EXCLAMATIONS.length);
  return CELEBRATION_EXCLAMATIONS[index] ?? 'Nice work!';
}

export function playCelebrationSound(): void {
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  try {
    const context = new AudioContextClass();
    const patterns: ReadonlyArray<ReadonlyArray<number>> = [
      [523.25, 659.25, 783.99, 1046.5],
      [392.0, 523.25, 659.25, 783.99, 1046.5],
      [440.0, 554.37, 659.25, 880.0],
      [329.63, 392.0, 493.88, 659.25, 783.99]
    ];
    const notes = patterns[Math.floor(Math.random() * patterns.length)] ?? patterns[0];
    const startAt = context.currentTime + 0.01;

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index % 2 === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt + index * 0.07);
      gain.gain.setValueAtTime(0.0001, startAt + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.14, startAt + index * 0.07 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.07 + 0.11);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + index * 0.07);
      oscillator.stop(startAt + index * 0.07 + 0.12);
    });

    window.setTimeout(() => {
      void context.close();
    }, Math.max(600, notes.length * 90));
  } catch {
    return;
  }
}