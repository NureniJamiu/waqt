import React from "react";
import { PrayerLogItem } from "../../types";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, History } from "lucide-react";

interface PrayerLogProps {
  logs: PrayerLogItem[];
  onBack: () => void;
}

export const PrayerLog: React.FC<PrayerLogProps> = ({ logs, onBack }) => {
  const totalConfirmed = logs.filter((l) => l.status === "confirmed").length;
  const totalEmergency = logs.filter((l) => l.status === "emergency_dismissed").length;
  const totalMissed = logs.filter((l) => l.status === "missed").length;

  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex justify-between items-center glass-panel px-6 py-4 rounded-2xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          <h1 className="font-bold text-lg">Prayer Accountability Log</h1>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmed</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalConfirmed}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency Dismiss</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalEmergency}</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <XCircle className="w-4 h-4" />
            <span>Missed Window</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalMissed}</div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Prayer</th>
                <th className="p-4">Scheduled</th>
                <th className="p-4">Status</th>
                <th className="p-4">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    No prayer logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4 font-mono text-slate-300">{log.date}</td>
                    <td className="p-4 font-semibold text-slate-100">{log.prayer}</td>
                    <td className="p-4 font-mono text-slate-400">
                      {new Date(log.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-4">
                      {log.status === "confirmed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      )}
                      {log.status === "emergency_dismissed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" /> Emergency
                        </span>
                      )}
                      {log.status === "missed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <XCircle className="w-3 h-3" /> Missed
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {log.confirmedAt
                        ? new Date(log.confirmedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
