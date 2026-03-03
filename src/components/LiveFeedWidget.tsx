import { useState, useRef, useCallback } from "react";

const STORAGE_KEY = "gb:livefeed:settings";

interface StreamConfig {
  id: string;
  brand: string;
  title: string;
  platform: "youtube" | "dailymotion";
  streamId: string;
  badgeColor?: string;
  startMuted?: boolean;
}

interface LiveFeedSettings {
  activeId: string;
  streams: StreamConfig[];
}

const DEFAULT_STREAM: StreamConfig = {
  id: "cgtn-default",
  brand: "CGTN",
  title: "China Global TV Network",
  platform: "dailymotion",
  streamId: "x8p5u0u",
  badgeColor: "#c8102e",
  startMuted: true,
};

const DEFAULT_SETTINGS: LiveFeedSettings = {
  activeId: "cgtn-default",
  streams: [DEFAULT_STREAM],
};

function loadSettings(): LiveFeedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LiveFeedSettings>;
      const streams = parsed.streams ?? [];
      const hasDefault = streams.some(s => s.id === "cgtn-default");
      return {
        activeId: parsed.activeId ?? "cgtn-default",
        streams: hasDefault ? streams : [DEFAULT_STREAM, ...streams],
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function persistSettings(s: LiveFeedSettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

function buildSrc(stream: StreamConfig): string {
  const muted = stream.startMuted ?? true;
  if (stream.platform === "youtube") {
    return `https://www.youtube.com/embed/${stream.streamId}?autoplay=1${muted ? "&mute=1" : ""}`;
  }
  return `https://www.dailymotion.com/embed/video/${stream.streamId}?autoplay=1${muted ? "&mute=1" : ""}&ui-logo=0&ui-start-screen-info=0`;
}

// ── Settings Modal ─────────────────────────────────────────────────────────────

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: LiveFeedSettings;
  onSave: (s: LiveFeedSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LiveFeedSettings>(settings);
  const [form, setForm] = useState({
    brand: "",
    title: "",
    platform: "youtube" as "youtube" | "dailymotion",
    streamId: "",
    badgeColor: "#1d4ed8",
    startMuted: true,
  });
  const [formError, setFormError] = useState("");

  const setActive = (id: string) =>
    setDraft(d => ({ ...d, activeId: id }));

  const deleteStream = (id: string) => {
    setDraft(d => {
      const streams = d.streams.filter(s => s.id !== id);
      const activeId = d.activeId === id ? (streams[0]?.id ?? "") : d.activeId;
      return { streams, activeId };
    });
  };

  const addStream = () => {
    if (!form.brand.trim()) { setFormError("Brand name is required."); return; }
    if (!form.streamId.trim()) { setFormError("Stream ID is required."); return; }
    setFormError("");
    const newStream: StreamConfig = {
      id: `stream-${Date.now()}`,
      brand: form.brand.trim(),
      title: form.title.trim(),
      platform: form.platform,
      streamId: form.streamId.trim(),
      badgeColor: form.badgeColor,
      startMuted: form.startMuted,
    };
    setDraft(d => ({ ...d, streams: [...d.streams, newStream] }));
    setForm({ brand: "", title: "", platform: "youtube", streamId: "", badgeColor: "#1d4ed8", startMuted: true });
  };

  const handleSave = () => {
    persistSettings(draft);
    onSave(draft);
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#fff",
    fontSize: 11,
    padding: "5px 9px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: "rgba(255,255,255,0.38)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(10,14,23,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          padding: "20px",
          width: 340,
          maxHeight: "80vh",
          overflowY: "auto",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#fff",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Live Feed Settings</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
              Manage streams &amp; branding
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: "rgba(255,255,255,0.45)",
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
              padding: "3px 7px",
              marginTop: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Saved streams */}
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", marginBottom: 8 }}>
          SAVED STREAMS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 18 }}>
          {draft.streams.map(s => (
            <div
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${s.id === draft.activeId ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.06)"}`,
                background: s.id === draft.activeId ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                cursor: "pointer",
              }}
            >
              <span style={{
                background: s.badgeColor ?? "rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: 8,
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: 2,
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {s.brand}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: s.id === draft.activeId ? "#fff" : "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title || s.brand}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>
                  {s.platform === "youtube" ? "YouTube" : "Dailymotion"} · {s.streamId}
                </div>
              </div>
              {s.id === draft.activeId && (
                <span style={{ fontSize: 8, fontWeight: 700, color: "#818cf8", letterSpacing: "0.06em", flexShrink: 0 }}>
                  ACTIVE
                </span>
              )}
              {s.id !== "cgtn-default" && (
                <button
                  onClick={e => { e.stopPropagation(); deleteStream(s.id); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: "0 2px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }} />

        {/* Add stream form */}
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.09em", marginBottom: 12 }}>
          ADD STREAM
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Platform selector */}
          <div>
            <span style={labelStyle}>Platform</span>
            <div style={{ display: "flex", gap: 6 }}>
              {(["youtube", "dailymotion"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(f => ({ ...f, platform: p }))}
                  style={{
                    flex: 1,
                    padding: "5px 0",
                    borderRadius: 6,
                    border: `1px solid ${form.platform === p ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"}`,
                    background: form.platform === p ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)",
                    color: form.platform === p ? "#a5b4fc" : "rgba(255,255,255,0.38)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {p === "youtube" ? "YouTube" : "Dailymotion"}
                </button>
              ))}
            </div>
          </div>

          {/* Stream ID */}
          <div>
            <span style={labelStyle}>
              Stream ID{" "}
              <span style={{ fontSize: 8, fontWeight: 400, opacity: 0.55 }}>
                {form.platform === "youtube" ? "(YouTube video/live ID)" : "(Dailymotion video ID)"}
              </span>
            </span>
            <input
              style={inputStyle}
              placeholder={form.platform === "youtube" ? "e.g. dQw4w9WgXcQ" : "e.g. x8p5u0u"}
              value={form.streamId}
              onChange={e => setForm(f => ({ ...f, streamId: e.target.value }))}
            />
          </div>

          {/* Brand */}
          <div>
            <span style={labelStyle}>Brand</span>
            <input
              style={inputStyle}
              placeholder="e.g. CNN, BBC, RT"
              value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
            />
          </div>

          {/* Brand color */}
          <div>
            <span style={labelStyle}>Brand Color</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="color"
                value={form.badgeColor}
                onChange={e => setForm(f => ({ ...f, badgeColor: e.target.value }))}
                style={{
                  width: 32,
                  height: 28,
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  background: "none",
                  cursor: "pointer",
                  padding: 2,
                  flexShrink: 0,
                }}
              />
              <span style={{
                background: form.badgeColor,
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 2,
                letterSpacing: "0.04em",
                flexShrink: 0,
              }}>
                {form.brand || "BRAND"}
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
                {form.badgeColor}
              </span>
            </div>
          </div>

          {/* Channel title */}
          <div>
            <span style={labelStyle}>Channel Title</span>
            <input
              style={inputStyle}
              placeholder="e.g. Cable News Network"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Start muted toggle */}
          <div
            onClick={() => setForm(f => ({ ...f, startMuted: !f.startMuted }))}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              borderRadius: 7,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Start muted</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>Autoplay without audio</div>
            </div>
            <div style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: form.startMuted ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.12)",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}>
              <div style={{
                position: "absolute",
                top: 2,
                left: form.startMuted ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }} />
            </div>
          </div>

          {formError && (
            <div style={{ fontSize: 10, color: "#f87171", marginTop: -4 }}>{formError}</div>
          )}

          <button
            onClick={addStream}
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.35)",
              borderRadius: 6,
              color: "#a5b4fc",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 0",
              cursor: "pointer",
              letterSpacing: "0.03em",
              width: "100%",
            }}
          >
            + Add Stream
          </button>
        </div>

        {/* Footer actions */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 18, paddingTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 6,
              color: "rgba(255,255,255,0.45)",
              fontSize: 11,
              fontWeight: 600,
              padding: "6px 16px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "rgba(99,102,241,0.22)",
              border: "1px solid rgba(99,102,241,0.5)",
              borderRadius: 6,
              color: "#a5b4fc",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 16px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LiveFeedWidget ─────────────────────────────────────────────────────────────

export default function LiveFeedWidget() {
  const [settings, setSettings] = useState<LiveFeedSettings>(loadSettings);
  const [modalOpen, setModalOpen] = useState(false);

  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLiveClick = useCallback(() => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      setModalOpen(true);
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 600);
    }
  }, []);

  const handleSave = useCallback((s: LiveFeedSettings) => {
    setSettings(s);
    setModalOpen(false);
  }, []);

  const activeStream =
    settings.streams.find(s => s.id === settings.activeId) ??
    settings.streams[0] ??
    DEFAULT_STREAM;

  const src = buildSrc(activeStream);

  return (
    <>
      <div
        style={{
          background: "rgba(10,14,23,0.88)",
          backdropFilter: "blur(12px)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
          flexShrink: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                background: activeStream.badgeColor ?? "rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.04em",
                padding: "1px 5px",
                borderRadius: 2,
              }}
            >
              {activeStream.brand}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
              {activeStream.title}
            </span>
          </div>

          <div
            onClick={handleLiveClick}
            style={{ display: "flex", alignItems: "center", gap: 4, cursor: "default", userSelect: "none" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 6px #ef4444",
                animation: "livefeed-ping 1.4s ease-in-out infinite",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", letterSpacing: "0.1em" }}>
              LIVE
            </span>
          </div>
        </div>

        {/* 16:9 embed */}
        <div style={{ position: "relative", paddingBottom: "56.25%" }}>
          <iframe
            key={src}
            src={src}
            title="Live Feed"
            allow="autoplay"
            allowFullScreen
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              border: "none",
              display: "block",
            }}
          />
        </div>

        <style>{`
          @keyframes livefeed-ping {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>

      {modalOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
