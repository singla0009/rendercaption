import React from "react";
import { WordInfo, formatStamp } from "../utils/exportFormatters";

interface TimelineSegmentProps {
  seg: WordInfo[];
  currentTime: number;
  seekTo: (time: number) => void;
}

const TimelineSegment = React.memo(({ seg, currentTime, seekTo }: TimelineSegmentProps) => {
  const startSec = seg[0].start;
  const endSec = seg[seg.length - 1].end;
  const isActiveSeg = currentTime >= startSec && currentTime <= endSec;

  return (
    <div className={`segment-block ${isActiveSeg ? "active-seg" : ""}`}>
      <div className="segment-stamp" onClick={() => seekTo(startSec)}>
        [{formatStamp(startSec)}]
      </div>
      <div className="segment-text">
        {seg.map((word, wi) => {
          const nextWordStart = wi < seg.length - 1 ? seg[wi + 1].start : word.end;
          const gap = nextWordStart - word.end;
          const effectiveEnd = gap < 1.0 ? nextWordStart : word.end + 0.1;
          const isActive = currentTime >= word.start && currentTime < effectiveEnd;
          const isLowConf = word.conf < 0.85;
          return (
            <span
              key={wi}
              onClick={() => seekTo(word.start)}
              className={`t-word ${isLowConf ? "low-conf" : ""} ${isActive ? "active" : ""}`}
              title={`Conf: ${(word.conf * 100).toFixed(0)}%`}
            >
              {word.w}
            </span>
          );
        })}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the segment is active in EITHER prev or next state.
  // If it's completely inactive in both, no CSS classes change, so we skip rendering!
  const prevActive =
    prevProps.currentTime >= prevProps.seg[0].start &&
    prevProps.currentTime <= prevProps.seg[prevProps.seg.length - 1].end;
  const nextActive =
    nextProps.currentTime >= nextProps.seg[0].start &&
    nextProps.currentTime <= nextProps.seg[nextProps.seg.length - 1].end;

  return prevProps.seg === nextProps.seg && !prevActive && !nextActive;
});

export default TimelineSegment;
