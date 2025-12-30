import { useLogs } from "@/hooks/use-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, RefreshCw, History, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function LogsPage() {
  const { data: logs, isLoading, refetch, isRefetching } = useLogs({ limit: "100" });
  const [search, setSearch] = useState("");

  const filteredLogs = logs?.filter(log => 
    log.sourceChannel?.toLowerCase().includes(search.toLowerCase()) ||
    log.destinationChannel?.toLowerCase().includes(search.toLowerCase()) ||
    log.details?.toLowerCase().includes(search.toLowerCase()) ||
    log.status?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex items-center justify-center h-full py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">سجلات النظام</h1>
          <p className="text-muted-foreground">مراقبة دقيقة لكل عمليات تحويل الرسائل والحالات.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isRefetching}
            className="h-10 px-4 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 me-2 ${isRefetching ? 'animate-spin' : ''}`} /> تحديث
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border shadow-sm bg-card">
        <CardHeader className="border-b bg-muted/30 px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> تفاصيل العمليات
            </CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="بحث في السجلات..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pr-10 rounded-lg bg-background/50 border-muted"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="w-[180px] font-bold text-foreground">الطابع الزمني</TableHead>
                  <TableHead className="font-bold text-foreground">المصدر</TableHead>
                  <TableHead className="font-bold text-foreground">الهدف</TableHead>
                  <TableHead className="w-[120px] font-bold text-foreground">الحالة</TableHead>
                  <TableHead className="font-bold text-foreground">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors border-b">
                    <TableCell className="text-sm font-medium text-muted-foreground">
                      {log.timestamp ? format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss") : "--"}
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[150px] font-semibold text-card-foreground">{log.sourceChannel}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[150px] font-semibold text-card-foreground">{log.destinationChannel}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`
                        rounded-full px-2.5 py-0.5 border shadow-sm font-bold
                        ${log.status === 'success' ? 'border-green-500/30 text-green-600 bg-green-500/10 dark:text-green-400 dark:bg-green-500/5' : ''}
                        ${log.status === 'failed' ? 'border-red-500/30 text-red-600 bg-red-500/10 dark:text-red-400 dark:bg-red-500/5' : ''}
                        ${log.status === 'skipped' ? 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10 dark:text-yellow-400 dark:bg-yellow-500/5' : ''}
                      `}>
                        {log.status === 'success' ? 'ناجح' : log.status === 'failed' ? 'فشل' : 'تخطى'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={log.details || ""}>
                      {log.details || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredLogs || filteredLogs.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-24 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Search className="h-10 w-10 opacity-20" />
                        <p>لا توجد سجلات مطابقة للبحث حالياً.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
