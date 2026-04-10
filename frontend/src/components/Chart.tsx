"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ChartInner = dynamic(() => import("./ChartInner").then((m) => m.ChartInner), {
  ssr: false,
  loading: () => null,
});

interface Props {
  options: any;
  className?: string;
}

export function Chart({ options, className }: Props) {
  return (
    <div className={className} style={{ minHeight: options?.chart?.height || 100 }}>
      <ChartInner options={options} />
    </div>
  );
}
