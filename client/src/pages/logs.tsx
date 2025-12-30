import { useLogs } from "@/hooks/use-logs";
import { CyberCard } from "@/components/ui/cyber-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LogsPage() {
  const { data: logs, isLoading, refetch, isRefetching } = useLogs({ limit: "50" });

  if (isLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-display uppercase tracking-widest text-white">System Logs</h2>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-transparent rounded-full" />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="border-primary/20 hover:bg-primary/10 hover:text-primary">
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <CyberCard className="p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader className="bg-black/20 sticky top-0 backdrop-blur-md z-10">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="font-mono text-primary w-[180px]">Timestamp</TableHead>
                <TableHead className="font-mono text-primary">Source</TableHead>
                <TableHead className="font-mono text-primary">Destination</TableHead>
                <TableHead className="font-mono text-primary w-[100px]">Status</TableHead>
                <TableHead className="font-mono text-primary">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {logs?.map((log) => (
                <TableRow key={log.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                  <TableCell className="text-muted-foreground group-hover:text-white transition-colors">
                    {log.timestamp ? format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}
                  </TableCell>
                  <TableCell className="truncate max-w-[150px]">{log.sourceChannel}</TableCell>
                  <TableCell className="truncate max-w-[150px]">{log.destinationChannel}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`
                      ${log.status === 'success' ? 'border-green-500 text-green-400 bg-green-500/10' : ''}
                      ${log.status === 'failed' ? 'border-red-500 text-red-400 bg-red-500/10' : ''}
                      ${log.status === 'skipped' ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : ''}
                    `}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate" title={log.details || ""}>
                    {log.details || "-"}
                  </TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No logs recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CyberCard>
    </>
  );
}
