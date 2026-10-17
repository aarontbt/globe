import { useState } from "react";
import { useStaticJson } from "../../hooks/useStaticJson";

interface SignalSnapshot {
  day: string;
  date: string;
  note?: string;
  scenarios: [number, number, number];
}
const EMPTY_HISTORY: { days: SignalSnapshot[] } = { days: [] };
const SERIES = [
  { label: "Base", color: "#34d399" },
  { label: "Stress", color: "#fbbf24" },
  { label: "Tail", color: "#f87171" },
];
const formatDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default function SignalsHistoryPanel() {
  const { data, loading, error } = useStaticJson("/data/charts-volatility.json", EMPTY_HISTORY);
  const [view, setView] = useState<"trend" | "daily">("trend");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const validDays = data.days.filter((day) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isFinite(Date.parse(day.date)) &&
    Array.isArray(day.scenarios) && day.scenarios.length === 3 &&
    day.scenarios.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) &&
    day.scenarios.reduce((sum, value) => sum + value, 0) === 100,
  ).sort((a, b) => a.date.localeCompare(b.date));
  const endDate = validDays[validDays.length - 1]?.date;
  const cutoff = endDate ? Date.parse(endDate) - 29 * 86_400_000 : 0;
  const days = validDays.filter((day) => Date.parse(day.date) >= cutoff);
  const selected = days.find((day) => day.date === selectedDate) ?? days[days.length - 1];
  const first = days[0];
  const last = days[days.length - 1];
  const unchanged = days.length > 1 && days.every((day) => day.scenarios.every((value, index) => value === first.scenarios[index]));

  const stepWidth = 832 / Math.max(days.length, 1);
  const chartX = (index: number) => 44 + (index + 0.5) * stepWidth;
  const chartY = (value: number) => 180 - value * 1.5;
  const bandPath = (seriesIndex: number) => {
    const boundary = (upper: boolean) => days.flatMap((day, index) => {
      const total = day.scenarios.slice(0, seriesIndex + (upper ? 1 : 0)).reduce((sum, value) => sum + value, 0);
      return [[44 + index * stepWidth, chartY(total)], [44 + (index + 1) * stepWidth, chartY(total)]];
    });
    return [...boundary(true), ...boundary(false).reverse()].map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ") + " Z";
  };

  return (
    <section className="signals-history" aria-labelledby="signals-history-title">
      <div className="signals-section-heading">
        <h2 id="signals-history-title" className="signals-label">Signals history · 30 days</h2>
        <span>Scenario probabilities · analyst estimates</span>
      </div>
      {loading || error || !selected ? (
        <p className="signals-empty" role="status">{loading ? "Loading history…" : "History unavailable"}</p>
      ) : (
        <>
          <div className="signals-history-toolbar">
            <div className="signals-history-views" role="group" aria-label="History chart view">
              <button type="button" aria-pressed={view === "trend"} onClick={() => setView("trend")}>Overview</button>
              <button type="button" aria-pressed={view === "daily"} onClick={() => setView("daily")}>Daily columns</button>
            </div>
            <span>{days.length} snapshots · {formatDate(first.date)} – {formatDate(last.date)} {last.date.slice(0, 4)}</span>
            <label>Snapshot
              <select value={selected.date} onChange={(event) => setSelectedDate(event.target.value)}>
                {days.map((day) => <option key={day.date} value={day.date}>{formatDate(day.date)} · {day.day}</option>)}
              </select>
            </label>
          </div>
          <div className="signals-history-metrics" aria-live="polite">
            {SERIES.map((series, index) => {
              const delta = selected.scenarios[index] - first.scenarios[index];
              return (
                <div key={series.label}>
                  <span><i style={{ background: series.color }} />{series.label}</span>
                  <strong>{selected.scenarios[index]}<small>%</small></strong>
                  {!unchanged && <span>{delta === 0 ? "Unchanged" : `${delta > 0 ? "+" : ""}${delta} pp`} <small>since {formatDate(first.date)}</small></span>}
                </div>
              );
            })}
          </div>
          {view === "trend" ? (
            <div className="signals-trend-scroll">
              <svg className="signals-trend-chart" viewBox="0 0 920 224" role="group" aria-label="Stepped scenario balance across saved snapshots. Date spacing is compressed.">
                {SERIES.map((series, index) => <path key={series.label} d={bandPath(index)} fill={series.color} fillOpacity="0.65" />)}
                {[0, 50, 100].map((value) => <g key={value} aria-hidden="true"><line x1="44" x2="876" y1={chartY(value)} y2={chartY(value)} stroke="rgba(255,255,255,0.18)" /><text x="34" y={chartY(value) + 4} textAnchor="end">{value}%</text></g>)}
                {days.map((day, index) => (
                  <g key={day.date} role="button" tabIndex={0} aria-pressed={selected.date === day.date}
                    aria-label={`${formatDate(day.date)}: ${SERIES.map((series, seriesIndex) => `${series.label} ${day.scenarios[seriesIndex]}%`).join(", ")}`}
                    onClick={() => setSelectedDate(day.date)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDate(day.date); } }}
                    className="signals-trend-snapshot">
                    <title>{formatDate(day.date)} · {day.scenarios.join(" / ")}%</title>
                    <rect x={44 + index * stepWidth} y="30" width={stepWidth} height="150" fill="transparent" />
                    {selected.date === day.date && <line x1={chartX(index)} x2={chartX(index)} y1="24" y2="184" stroke="white" strokeDasharray="3 3" pointerEvents="none" />}
                    {(index === 0 || index === days.length - 1 || index % 3 === 0) && <text x={chartX(index)} y="207" textAnchor="middle">{formatDate(day.date)}</text>}
                  </g>
                ))}
              </svg>
            </div>
          ) : (
          <div className="signals-columns-chart" role="group" aria-label="Scenario probabilities by saved date. Dates without data are omitted. Select a column to inspect its snapshot.">
            <div className="signals-columns-axis" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
            <div className="signals-columns-scroll" tabIndex={0} aria-label="Scrollable daily chart">
              <div className="signals-columns" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(36px, 1fr))` }}>
                {days.map((snapshot, index) => {
                  const { date } = snapshot;
                  const dateLabel = <span className="signals-column-date" aria-hidden="true">{Number(date.slice(8))}<small>{index === 0 || date.slice(0, 7) !== days[index - 1].date.slice(0, 7) ? formatDate(date).split(" ")[1] : "\u00a0"}</small></span>;
                  return (
                    <button
                      key={date}
                      type="button"
                      className="signals-column"
                      aria-pressed={selected.date === date}
                      aria-label={`${formatDate(date)}: ${SERIES.map((series, seriesIndex) => `${series.label} ${snapshot.scenarios[seriesIndex]}%`).join(", ")}`}
                      title={`${formatDate(date)} · ${snapshot.scenarios.join(" / ")}%`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <span className="signals-column-stack" aria-hidden="true">
                        {SERIES.map((series, seriesIndex) => <span key={series.label} style={{ height: `${snapshot.scenarios[seriesIndex]}%`, background: series.color }} />)}
                      </span>
                      {dateLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          )}
          <p className="signals-history-caption">{unchanged ? "No probability changes in this period." : "Select a snapshot to inspect the outlook."} Recorded dates only; spacing compressed.</p>
          {selected.note && <details className="signals-history-note"><summary>{formatDate(selected.date)} update</summary><p>{selected.note}</p></details>}
        </>
      )}
    </section>
  );
}
