export default function LegendPanel() {
  return (
    <div className="absolute bottom-6 left-6 z-10 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl">
      <h2 className="text-[10px] tracking-[0.2em] text-white/40 uppercase mb-2.5">
        Legend
      </h2>

      <div className="flex flex-col gap-2">
        {/* Lane width → Trade Volume */}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-[3px] rounded-full bg-cyan-400" />
          <span className="text-[11px] text-white/70">
            Lane width &rarr; Trade Volume
          </span>
        </div>

        {/* Port size → TEU Throughput (ASEAN teal, Partner gold) */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-teal-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <span className="text-[11px] text-white/70">
            Port size &rarr; TEU Throughput
          </span>
        </div>

        {/* Arc → Bilateral Trade Flow */}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500" />
          <span className="text-[11px] text-white/70">
            Arc &rarr; Bilateral Trade Flow
          </span>
        </div>

        {/* White dot → Vessel (animated) */}
        <div className="flex items-center gap-2.5">
          <div className="flex w-5 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
          <span className="text-[11px] text-white/70">
            Vessel (animated)
          </span>
        </div>
      </div>
    </div>
  );
}
