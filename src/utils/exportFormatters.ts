export interface WordInfo {
  w: string;
  start: number;
  end: number;
  conf: number;
}

export interface TranscriptionResult {
  text: string;
  words: WordInfo[];
  audio_duration: number;
  total_time: number;
  rtf: number;
}

export const formatSrtTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

export const formatStamp = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const getSegments = (result: TranscriptionResult | null): WordInfo[][] => {
  if (!result) return [];
  const segments: WordInfo[][] = [];
  let curr: WordInfo[] = [];
  
  result.words.forEach((w) => {
    if (curr.length === 0) {
      curr.push(w);
    } else {
      const last = curr[curr.length - 1];
      if (w.start - last.end > 1.0 || curr.length > 20) {
        segments.push(curr);
        curr = [w];
      } else {
        curr.push(w);
      }
    }
  });
  if (curr.length > 0) segments.push(curr);
  return segments;
};

export const generateSrtContent = (result: TranscriptionResult): string => {
  let srt = "";
  result.words.forEach((word, index) => {
    srt += `${index + 1}\n${formatSrtTime(word.start)} --> ${formatSrtTime(word.end)}\n${word.w}\n\n`;
  });
  return srt;
};

export const generateAdvancedSrtContent = (result: TranscriptionResult, maxWords: number, maxGap: number): string => {
  let srt = "";
  let segments: WordInfo[][] = [];
  let curr: WordInfo[] = [];
  
  result.words.forEach((w) => {
    if (curr.length === 0) {
      curr.push(w);
    } else {
      const last = curr[curr.length - 1];
      if (w.start - last.end > maxGap || curr.length >= maxWords) {
        segments.push(curr);
        curr = [w];
      } else {
        curr.push(w);
      }
    }
  });
  if (curr.length > 0) segments.push(curr);

  segments.forEach((seg, index) => {
    const text = seg.map(w => w.w).join(" ");
    srt += `${index + 1}\n${formatSrtTime(seg[0].start)} --> ${formatSrtTime(seg[seg.length - 1].end)}\n${text}\n\n`;
  });

  return srt;
};
