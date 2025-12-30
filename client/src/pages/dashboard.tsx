import { useStats } from "@/hooks/use-logs";
import { CyberCard } from "@/components/ui/cyber-card";
import { Activity, Zap, Server, MessageSquare, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useLogs } from "@/hooks/use-logs";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats } = useStats();
  const { data: recentLogs } = useLogs({ limit: "10" });

  // Mock data for chart - in real app would aggregate logs
  const chartData = [
    { name: '00:00', messages: 40 },
    { name: '04:00', messages: 30 },
    { name: '08:00', messages: 20 },
    { name: '12:00', messages: 80 },
    { name: '16:00', messages: 110 },
    { name: '20:00', messages: 90 },
    { name: '23:59', messages: 60 },
  ];

  return (
    <>
      <div className="flex flex-col gap-2 mb-8">
        <h2 className="text-3xl font-display uppercase tracking-widest text-white">Command Center</h2>
        <div className="h-1 w-24 bg-gradient-to-r from-primary to-transparent rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CyberCard gradient="primary" delay={0.1}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Active Tasks</p>
              <h3 className="text-4xl font-display text-white mt-2">{stats?.activeTasks || 0}</h3>
            </div>
            <div className="p-3 bg-primary/20 rounded-lg text-primary neon-text">
              <Zap className="w-6 h-6" />
            </div>
          </div>
        </CyberCard>

        <CyberCard gradient="secondary" delay={0.2}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Total Forwarded</p>
              <h3 className="text-4xl font-display text-white mt-2">{stats?.totalForwarded || 0}</h3>
            </div>
            <div className="p-3 bg-secondary/20 rounded-lg text-secondary neon-text">
              <MessageSquare className="w-6 h-6" />
            </div>
          </div>
        </CyberCard>

        <CyberCard gradient="accent" delay={0.3}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Uptime (hrs)</p>
              <h3 className="text-4xl font-display text-white mt-2">{(stats?.uptime ? stats.uptime / 3600 : 0).toFixed(1)}</h3>
            </div>
            <div className="p-3 bg-accent/20 rounded-lg text-accent neon-text">
              <Activity className="w-6 h-6" />
            </div>
          </div>
        </CyberCard>

        <CyberCard gradient={stats?.workerStatus === 'running' ? 'primary' : 'secondary'} delay={0.4}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">System Status</p>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${stats?.workerStatus === 'running' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`} />
                <h3 className="text-xl font-display text-white uppercase">{stats?.workerStatus || 'Unknown'}</h3>
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-lg text-white">
              <Server className="w-6 h-6" />
            </div>
          </div>
        </CyberCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <CyberCard className="lg:col-span-2 min-h-[400px]" delay={0.5}>
          <h3 className="text-lg font-display mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Traffic Analysis
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180 100% 50%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(180 100% 50%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(230 25% 8%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  itemStyle={{ color: 'hsl(180 100% 50%)' }}
                />
                <Area type="monotone" dataKey="messages" stroke="hsl(180 100% 50%)" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CyberCard>

        <CyberCard delay={0.6}>
          <h3 className="text-lg font-display mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-secondary" /> Recent Activity
          </h3>
          <div className="space-y-4">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5 hover:border-white/20 transition-all">
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-primary shadow-[0_0_8px_#00ffff]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                      <p className="text-xs font-mono text-white truncate w-32">
                        {log.sourceChannel} → {log.destinationChannel}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 ml-3.5">
                      {log.timestamp ? format(new Date(log.timestamp), "HH:mm:ss") : "--:--"}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                    log.status === 'success' ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {log.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No recent activity detected.
              </div>
            )}
          </div>
        </CyberCard>
      </div>
    </>
  );
}
