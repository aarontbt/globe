export default function TitleOverlay() {
  return (
    <div className="absolute top-6 left-6 z-10 p-5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl">
      {/* Title row with LIVE indicator */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-white text-lg font-semibold leading-tight">
            ASEAN Intelligence
          </h1>
          <p className="text-xs text-white/60 mt-0.5">
            Trade Corridor Analytics &bull; Maybank Advisory
          </p>
        </div>

        {/* LIVE badge */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-green-400 tracking-wide">
            LIVE
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/50">
        <span>10 Corridors</span>
        <span>&bull;</span>
        <span>20 Ports</span>
        <span>&bull;</span>
        <span>~80 Vessels</span>
      </div>
    </div>
  );
}
