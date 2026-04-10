"use client";

import { useEffect, useRef } from "react";
import Highcharts from "highcharts";
import "highcharts/highcharts-more";
import "highcharts/modules/heatmap";
import "highcharts/modules/solid-gauge";
import HighchartsReact from "highcharts-react-official";

let themed = false;

function applyTheme() {
  if (themed) return;
  themed = true;

  Highcharts.setOptions({
    colors: ["#2563eb", "#dc2626", "#d97706", "#16a34a", "#7c3aed", "#0891b2", "#c026d3"],

    chart: {
      backgroundColor: "#ffffff",
      style: {
        fontFamily:
          "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      },
      spacing: [20, 16, 16, 4],
    },

    title: { text: undefined } as any,
    subtitle: {
      style: { color: "#94a3b8", fontSize: "11px", letterSpacing: "0.01em" },
    },
    credits: { enabled: false },

    legend: {
      itemStyle: { color: "#475569", fontWeight: "400", fontSize: "11px" },
      itemHoverStyle: { color: "#0f172a" },
      borderWidth: 0,
      backgroundColor: "transparent",
      symbolRadius: 3,
    },

    xAxis: {
      gridLineColor: "#f1f5f9",
      gridLineWidth: 1,
      lineColor: "#e2e8f0",
      tickColor: "#e2e8f0",
      tickLength: 4,
      labels: {
        style: { color: "#64748b", fontSize: "11px" },
        y: 18,
      },
      crosshair: {
        color: "rgba(148,163,184,0.25)",
        dashStyle: "Dot",
        width: 1,
      },
    } as any,

    yAxis: {
      gridLineColor: "#f1f5f9",
      gridLineWidth: 1,
      lineWidth: 0,
      tickLength: 0,
      labels: {
        style: { color: "#64748b", fontSize: "11px" },
        x: -8,
      },
      title: { text: undefined },
    } as any,

    tooltip: {
      backgroundColor: "#1e293b",
      borderWidth: 0,
      borderRadius: 8,
      padding: 12,
      shadow: { color: "rgba(0,0,0,0.18)", offsetX: 0, offsetY: 4, width: 20, opacity: 1 },
      style: { color: "#f8fafc", fontSize: "12px", lineHeight: "18px" },
      useHTML: true,
    },

    plotOptions: {
      series: {
        animation: { duration: 450 },
        states: {
          hover: { lineWidthPlus: 0 },
          inactive: { opacity: 0.35 },
        },
      },
      line: {
        lineWidth: 2,
        marker: {
          enabled: false,
          radius: 4,
          lineWidth: 0,
          states: { hover: { enabled: true, radius: 5, lineWidth: 0 } },
        },
      },
      spline: {
        lineWidth: 2,
        marker: {
          enabled: false,
          radius: 4,
          lineWidth: 0,
          states: { hover: { enabled: true, radius: 5, lineWidth: 0 } },
        },
      },
      areaspline: {
        lineWidth: 1.5,
        fillOpacity: 0.08,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
      },
      area: {
        lineWidth: 1.5,
        fillOpacity: 0.1,
        marker: { enabled: false },
      },
      column: {
        borderWidth: 0,
        borderRadius: 3,
        pointPadding: 0.08,
        groupPadding: 0.15,
      },
      bar: {
        borderWidth: 0,
        borderRadius: 3,
        pointPadding: 0.08,
        groupPadding: 0.15,
      },
      scatter: {
        marker: {
          radius: 3,
          lineWidth: 0,
          states: { hover: { radius: 5 } },
        },
      },
      heatmap: {
        borderWidth: 2,
        borderColor: "#fff",
      },
      solidgauge: {
        dataLabels: { borderWidth: 0 },
        linecap: "round",
        rounded: true,
      },
    },
  });
}

applyTheme();

export function ChartInner({ options }: { options: any }) {
  const ref = useRef<any>(null);

  useEffect(() => {
    const handle = () => ref.current?.chart?.reflow();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  return <HighchartsReact highcharts={Highcharts} options={options} ref={ref} />;
}
