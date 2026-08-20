import React, { useState, useEffect } from "react";
import { PrayerLogItem, PrayerStatus } from "../../types";
import { loadLogs, subscribeLogUpdated } from "../../lib/store";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, History, Filter } from "lucide-react";

interface PrayerLogProps {
  logs: PrayerLogItem[];
  onBack: () => void;
}

export const PrayerLog: React.FC<PrayerLogProps> = ({ logs: propLogs, onBack }) => {
  const [logs, setLogs] = useState<PrayerLogItem[]>(propLogs);
  const [filter, setFilter] = useState<"all" | PrayerStatus>("all");

  useEffect(() => {
    setLogs(propLogs);
  }, [propLogs]);

  useEffect(() => {
    loadLogs().then((hydrated) => setLogs(hydrated));

    const unsubscribe = subscribeLogUpdated(() => {
      loadLogs().then((updated) => setLogs(updated));
    });

    return unsubscribe;
  }, []);

  const totalConfirmed = logs.filter((l) => l.status === "confirmed").length;
  const totalEmergency = logs.filter((l) => l.status === "emergency_dismissed").length;
  const totalMissed = logs.filter((l) => l.status === "missed").length;

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.status === filter);

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="line-surface rounded-md px-6 py-4 flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          <h1 className="font-extrabold font-display text-lg text-white">Prayer Accountability Log</h1>
        </div>
      </header>

      <div className="line-surface rounded-md overflow-hidden">
        <div className="grid grid-cols-3">
        <div
          onClick={() => setFilter(filter === "confirmed" ? "all" : "confirmed")}
          className={`p-5 border-r line-divider transition-all cursor-pointer ${
            filter === "confirmed"
              ? "bg-emerald-500/10"
              : "hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmed</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">{totalConfirmed}</div>
        </div>

        <div
          onClick={() => setFilter(filter === "emergency_dismissed" ? "all" : "emergency_dismissed")}
          className={`p-5 border-r line-divider transition-all cursor-pointer ${
            filter === "emergency_dismissed"
              ? "bg-amber-500/10"
              : "hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">{totalEmergency}</div>
        </div>

        <div
          onClick={() => setFilter(filter === "missed" ? "all" : "missed")}
          className={`p-5 transition-all cursor-pointer ${
            filter === "missed"
              ? "bg-slate-800/70"
              : "hover:bg-slate-900/50"
          }`}
        >
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
            <XCircle className="w-4 h-4" />
            <span>Missed</span>
          </div>
          <div className="text-3xl font-black font-mono text-white tracking-tight">{totalMissed}</div>
        </div>
      </div>
      </div>

      <div className="line-surface rounded-md overflow-hidden">
        <div className="p-4 md:px-6 border-b line-divider flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Log Filter</span>
          </div>

          <div className="flex gap-1 line-chip p-1 rounded-md">
            {(["all", "confirmed", "emergency_dismissed", "missed"] as const).map((statusKey) => (
              <button
                key={statusKey}
                onClick={() => setFilter(statusKey)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${
                  filter === statusKey
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
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
              <tr className="border-b line-divider bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Date</th>
                <th className="p-4">Prayer</th>
                <th className="p-4">Scheduled</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic font-medium">
                    No matching prayer logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4 pl-6 font-mono text-slate-300 font-semibold">{log.date}</td>
                    <td className="p-4 font-bold text-white font-display text-sm">{log.prayer}</td>
                    <td className="p-4 font-mono text-slate-400">
                      {new Date(log.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-4">
                      {log.status === "confirmed" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      )}
                      {log.status === "emergency_dismissed" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" /> Emergency
                        </span>
                      )}
                      {log.status === "missed" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          <XCircle className="w-3 h-3" /> Missed
                        </span>
                      )}
                    </td>
                    <td className="p-4 pr-6 font-mono text-slate-400">
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
