import type { LaneOverlay } from "@roadcopilot/contracts";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";

type Props = {
  overlay: LaneOverlay | null | undefined;
  /** Pixel size of the JPEG that was sent for this (or last successful) analysis. */
  captureWidth: number;
  captureHeight: number;
  /** Same box as the camera preview (`onLayout` on the wrapper). */
  layoutWidth: number;
  layoutHeight: number;
};

/**
 * Maps analysis pixel coords (server-resized frame) into the preview rect using the same
 * "contain" scaling as if the captured still were letterboxed in the preview.
 */
function mapPoint(
  ax: number,
  ay: number,
  analysisW: number,
  analysisH: number,
  captureW: number,
  captureH: number,
  layoutW: number,
  layoutH: number
): { x: number; y: number } {
  const jx = (ax / analysisW) * captureW;
  const jy = (ay / analysisH) * captureH;
  const s = Math.min(layoutW / captureW, layoutH / captureH);
  const dx = (layoutW - captureW * s) / 2;
  const dy = (layoutH - captureH * s) / 2;
  return { x: dx + jx * s, y: dy + jy * s };
}

function segmentToLine(
  seg: { x1: number; y1: number; x2: number; y2: number },
  analysisW: number,
  analysisH: number,
  captureW: number,
  captureH: number,
  layoutW: number,
  layoutH: number
): { x1: number; y1: number; x2: number; y2: number } {
  const a = mapPoint(seg.x1, seg.y1, analysisW, analysisH, captureW, captureH, layoutW, layoutH);
  const b = mapPoint(seg.x2, seg.y2, analysisW, analysisH, captureW, captureH, layoutW, layoutH);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function roiToPointsString(
  roi: { x: number; y: number }[],
  analysisW: number,
  analysisH: number,
  captureW: number,
  captureH: number,
  layoutW: number,
  layoutH: number
): string {
  return roi
    .map((p) => {
      const m = mapPoint(p.x, p.y, analysisW, analysisH, captureW, captureH, layoutW, layoutH);
      return `${m.x},${m.y}`;
    })
    .join(" ");
}

export const LaneAnalysisOverlay = memo(function LaneAnalysisOverlay({
  overlay,
  captureWidth,
  captureHeight,
  layoutWidth,
  layoutHeight,
}: Props) {
  const dimsOk =
    overlay &&
    captureWidth > 0 &&
    captureHeight > 0 &&
    layoutWidth > 0 &&
    layoutHeight > 0 &&
    overlay.width > 0 &&
    overlay.height > 0;

  const elements = useMemo(() => {
    if (!dimsOk || !overlay) return null;

    const aw = overlay.width;
    const ah = overlay.height;
    const cw = captureWidth;
    const ch = captureHeight;
    const lw = layoutWidth;
    const lh = layoutHeight;

    const roiEl =
      overlay.roi && overlay.roi.length >= 3 ? (
        <Polygon
          key="roi"
          points={roiToPointsString(overlay.roi, aw, ah, cw, ch, lw, lh)}
          fill="rgba(255, 193, 7, 0.08)"
          stroke="rgba(255, 213, 79, 0.55)"
          strokeWidth={1.5}
        />
      ) : null;

    const faint = (overlay.segments ?? []).map((seg, i) => {
      const { x1, y1, x2, y2 } = segmentToLine(seg, aw, ah, cw, ch, lw, lh);
      return (
        <Line
          key={`s-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(200, 200, 200, 0.35)"
          strokeWidth={1}
        />
      );
    });

    const left = (overlay.leftBoundary ?? []).map((seg, i) => {
      const { x1, y1, x2, y2 } = segmentToLine(seg, aw, ah, cw, ch, lw, lh);
      return (
        <Line
          key={`L-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(77, 208, 225, 0.95)"
          strokeWidth={2.5}
        />
      );
    });

    const right = (overlay.rightBoundary ?? []).map((seg, i) => {
      const { x1, y1, x2, y2 } = segmentToLine(seg, aw, ah, cw, ch, lw, lh);
      return (
        <Line
          key={`R-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="rgba(255, 183, 77, 0.95)"
          strokeWidth={2.5}
        />
      );
    });

    return (
      <>
        {roiEl}
        {faint}
        {left}
        {right}
      </>
    );
  }, [dimsOk, overlay, captureWidth, captureHeight, layoutWidth, layoutHeight]);

  if (!dimsOk || !elements) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width={layoutWidth} height={layoutHeight}>
        {elements}
      </Svg>
    </View>
  );
});
