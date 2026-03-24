export type AudioCue = 'janken' | 'pon' | 'aikode' | 'sho' | 'acchimuite' | 'hoi';

const AUDIO_SOURCES: Record<AudioCue, string> = {
  janken: '/audio/janken.wav',
  pon: '/audio/pon.wav',
  aikode: '/audio/aikode.wav',
  sho: '/audio/sho.wav',
  acchimuite: '/audio/acchimuite.wav',
  hoi: '/audio/hoi.wav',
};

const audioCache: Partial<Record<AudioCue, HTMLAudioElement>> = {};

function getAudio(cue: AudioCue): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  if (!audioCache[cue]) {
    const audio = new Audio(AUDIO_SOURCES[cue]);
    audio.preload = 'auto';
    audioCache[cue] = audio;
  }

  return audioCache[cue] ?? null;
}

export function playAudioCue(cue: AudioCue): void {
  const target = getAudio(cue);
  if (!target) {
    return;
  }

  stopAllAudio();
  target.currentTime = 0;
  void target.play().catch(() => {});
}

export function stopAllAudio(): void {
  Object.values(audioCache).forEach((audio) => {
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
  });
}
