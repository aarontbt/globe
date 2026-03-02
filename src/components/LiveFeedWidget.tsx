const DAILYMOTION_VIDEO_ID = "x8p5u0u"; // CGTN live

export default function LiveFeedWidget() {
  const src = `https://www.dailymotion.com/embed/video/${DAILYMOTION_VIDEO_ID}?autoplay=1&mute=1&ui-logo=0&ui-start-screen-info=0`;

  return (
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
              background: "#c8102e",
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.04em",
              padding: "1px 5px",
              borderRadius: 2,
            }}
          >
            CGTN
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>China Global TV Network</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#ef4444",
              boxShadow: "0 0 6px #ef4444",
              animation: "livefeed-ping 1.4s ease-in-out infinite",
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
  );
}
