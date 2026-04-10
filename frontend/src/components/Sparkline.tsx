interface Props {
  data: number[];
  min: number;
  max: number;
  width?: number;
  height?: number;
  stroke?: string;
}

export function Sparkline({ data, min, max, width = 96, height = 28, stroke = "#1d1d1f" }: Props) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const lo = Math.min(min, ...data);
  const hi = Math.max(max, ...data);
  const range = hi - lo || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - lo) / range) * height).toFixed(1)}`)
    .join(" ");
  // Limit band
  const yMin = height - ((min - lo) / range) * height;
  const yMax = height - ((max - lo) / range) * height;
  return (
    <svg width={width} height={height} className="block">
      <rect x={0} y={Math.min(yMin, yMax)} width={width} height={Math.abs(yMax - yMin)} fill="#1d1d1f" opacity={0.04} />
      <polyline fill="none" stroke={stroke} strokeWidth={1.25} points={points} />
    </svg>
  );
}
