import { Monitor, Laptop } from "lucide-react";
import Image from "next/image";

export default function MobileBlocker() {
  return (
    <div className="lg:hidden fixed inset-0 z-[200] bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <Image src="/logo.png" alt="Thyleads" width={28} height={28} className="rounded-lg" />
          <span className="text-[13px] font-bold text-slate-900">Thyleads</span>
        </div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6800FF] to-[#4a00b8] mx-auto flex items-center justify-center shadow-lg shadow-[#6800FF]/20">
          <Laptop size={28} className="text-white" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 mt-5">Desktop only</h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          This dashboard is built for larger screens. Please open it on a desktop or laptop for the best experience.
        </p>
        <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6800FF] bg-[#6800FF]/5 border border-[#6800FF]/10 px-3 py-1.5 rounded-md">
          <Monitor size={11} /> Minimum width: 1024px
        </div>
      </div>
    </div>
  );
}
