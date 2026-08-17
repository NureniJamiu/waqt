import React, { useState } from "react";
import { PrayerLogItem, PrayerStatus } from "../../types";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, History, Filter } from "lucide-react";

interface PrayerLogProps {
  logs: PrayerLogItem[];
  onBack: () => void;
}

export const PrayerLog: React.FC<PrayerLogProps> = ({ logs, onBack }) => {
  const [filter, setFilter] = useState<"all" | PrayerStatus>("all");

  const totalConfirmed = logs.filter((l) => l.status === "confirmed").length;
  const totalEmergency = logs.filter((l) => l.status === "emergency_dismissed").length;
  const totalMissed = logs.filter((l) => l.status === "missed").length;

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.status === filter);

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
        <div
          onClick={() => setFilter(filter === "confirmed" ? "all" : "confirmed")}
          className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "confirmed" ? "border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/20" : "border-emerald-500/30 hover:border-emerald-500/50"
          }`}
        >
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmed</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalConfirmed}</div>
        </div>

        <div
          onClick={() => setFilter(filter === "emergency_dismissed" ? "all" : "emergency_dismissed")}
          className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "emergency_dismissed" ? "border-amber-500 bg-amber-950/20 ring-2 ring-amber-500/20" : "border-amber-500/30 hover:border-amber-500/50"
          }`}
        >
          <div className="flex items-center gap-2 text-amber-400 text-xs font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency Dismiss</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalEmergency}</div>
        </div>

        <div
          onClick={() => setFilter(filter === "missed" ? "all" : "missed")}
          className={`glass-panel p-4 rounded-2xl border transition-all cursor-pointer ${
            filter === "missed" ? "border-slate-500 bg-slate-800/40 ring-2 ring-slate-500/20" : "border-slate-700 hover:border-slate-600"
          }`}
        >
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <XCircle className="w-4 h-4" />
            <span>Missed Window</span>
          </div>
          <div className="text-2xl font-bold font-mono">{totalMissed}</div>
        </div>
      </div>

      {/* Filter Tabs & Table Container */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Filter Status</span>
          </div>

          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(["all", "confirmed", "emergency_dismissed", "missed"] as const).map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setFilter(statusKey)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filter === statusKey
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {statusKey === "emergency_dismissed" ? "Emergency" : statusKey}
              </button>
            ))}
          </div>
        </div>

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
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    No matching prayer logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
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

