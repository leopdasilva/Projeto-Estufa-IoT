import { useState } from "react";
import { useListLeituras } from "../src/lib/api-client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { format } from "date-fns";
import { History, Thermometer, Droplets, Sun, Wind } from "lucide-react";

export default function Historico() {
  const [limite] = useState(20);

  // Hook reativo via MQTT — atualiza em tempo real quando o ESP32 envia dados
  const { data: leiturasData, isLoading } = useListLeituras({ limite });

  // Inverte para exibir os mais recentes no topo da tabela
  const leituras = Array.isArray(leiturasData) ? [...leiturasData].reverse() : [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-primary gap-4 animate-in fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-serif font-bold text-xl">Carregando histórico de leituras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-4xl font-black text-primary mb-2 tracking-tight flex items-center gap-3">
            Histórico do Sistema
          </h2>
          <p className="text-foreground/80 max-w-xl text-lg font-medium">
            Registros brutos enviados pelo ESP32 via MQTT em tempo real.
          </p>
        </div>
      </header>

      <Card className="shadow-lg border-card-border overflow-hidden">
        <CardHeader className="bg-card/50 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-xl font-serif">
            <History className="w-5 h-5 text-primary" /> Registros Recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold">Data &amp; Hora</TableHead>
                <TableHead className="font-bold">
                  <div className="flex items-center gap-1">
                    <Thermometer className="w-4 h-4" /> Temp.
                  </div>
                </TableHead>
                <TableHead className="font-bold">
                  <div className="flex items-center gap-1">
                    <Wind className="w-4 h-4" /> Umidade
                  </div>
                </TableHead>
                <TableHead className="font-bold">
                  <div className="flex items-center gap-1">
                    <Droplets className="w-4 h-4" /> Reservatório
                  </div>
                </TableHead>
                <TableHead className="font-bold">
                  <div className="flex items-center gap-1">
                    <Sun className="w-4 h-4" /> Luz
                  </div>
                </TableHead>
                <TableHead className="font-bold">Status Atuadores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leituras.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Nenhum registro encontrado. Aguardando dados do ESP32...
                  </TableCell>
                </TableRow>
              ) : (
                leituras.map((leitura: any, index: number) => (
                  <TableRow
                    key={leitura?.id || index}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-mono text-sm">
                      {leitura?.criadoEm
                        ? format(new Date(leitura.criadoEm), "dd/MM/yyyy HH:mm:ss")
                        : "--/--/---- --:--:--"}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-foreground">
                      {leitura?.temperatura ?? 0}°C
                    </TableCell>
                    <TableCell className="font-mono font-bold text-foreground">
                      {leitura?.umidade ?? 0}%
                    </TableCell>
                    <TableCell className="font-mono font-bold text-foreground">
                      {leitura?.aguaPct ?? 0}%
                    </TableCell>
                    <TableCell className="font-mono font-bold text-foreground">
                      {leitura?.luz ?? 0} lx
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {leitura?.bombaLigada && (
                          <Badge className="bg-blue-500 text-white">BOMBA</Badge>
                        )}
                        {leitura?.exaustorLigado && (
                          <Badge className="bg-amber-500 text-white">EXAUSTOR</Badge>
                        )}
                        {!leitura?.bombaLigada && !leitura?.exaustorLigado && (
                          <span className="text-xs text-muted-foreground">STANDBY</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}