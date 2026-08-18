import { useListAlertas } from "../src/lib/api-client";
import { cn } from "../src/lib/utils";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { format } from "date-fns";
import { AlertTriangle, Thermometer, Droplets } from "lucide-react";

export default function Alertas() {
  // Busca os alertas — reativo via MQTT (atualiza automaticamente)
  const { data: alertasData, isLoading } = useListAlertas();
  const alertas: any[] = alertasData || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-destructive gap-4 animate-in fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-destructive border-t-transparent animate-spin" />
        <p className="font-serif font-bold text-xl">Acessando log de emergência...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex items-center gap-4">
        <div className="p-4 bg-destructive/10 rounded-2xl text-destructive">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="font-serif text-4xl font-black text-destructive mb-2 tracking-tight flex items-center gap-3">
            Log de Alertas
          </h2>
          <p className="text-foreground/80 max-w-xl text-lg font-medium">
            Eventos onde os limites de segurança biológica da estufa foram excedidos.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado vazio */}
        {alertas.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center text-center text-foreground/50 border-2 border-dashed border-border rounded-2xl bg-background/50">
            <div className="w-16 h-16 rounded-full bg-success/20 text-success flex items-center justify-center mb-4">
              <span className="text-3xl">🌱</span>
            </div>
            <h3 className="font-serif text-xl text-foreground font-bold mb-2">
              Ambiente Estável
            </h3>
            <p className="max-w-sm">
              Nenhum alerta registrado até o momento. Suas plantas estão em condições ideais de crescimento.
            </p>
          </div>
        )}

        {/* Lista de alertas */}
        {alertas.map((alerta: any) => {
          const isTemp = alerta.tipo === "TEMP_ALTA";
          return (
            <Card
              key={alerta.id || alerta.criadoEm}
              className={cn(
                "relative overflow-hidden shadow-lg border-2",
                isTemp ? "border-destructive/40" : "border-blue-500/40"
              )}
            >
              {/* Barra lateral colorida */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-2",
                  isTemp ? "bg-destructive" : "bg-blue-500"
                )}
              />

              <CardHeader className="pb-2 flex flex-row items-center justify-between pl-8">
                <div
                  className={cn(
                    "flex items-center gap-2 font-bold text-lg font-sans",
                    isTemp ? "text-destructive" : "text-blue-600"
                  )}
                >
                  {isTemp ? (
                    <Thermometer className="w-6 h-6" />
                  ) : (
                    <Droplets className="w-6 h-6" />
                  )}
                  {isTemp ? "Sobreaquecimento Detectado" : "Estresse Hídrico - Nível Baixo"}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono shadow-sm bg-background border",
                    isTemp
                      ? "border-destructive/20 text-destructive"
                      : "border-blue-500/20 text-blue-600"
                  )}
                >
                  {alerta.criadoEm
                    ? format(new Date(alerta.criadoEm), "HH:mm:ss")
                    : "--:--:--"}
                </Badge>
              </CardHeader>

              <CardContent className="pl-8 pt-4">
                <div className="flex justify-between items-end bg-background/50 p-4 rounded-xl border border-border">
                  <div>
                    <p className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-1">
                      Pico Registrado
                    </p>
                    <p
                      className={cn(
                        "text-4xl font-mono font-bold tracking-tighter",
                        isTemp ? "text-destructive" : "text-blue-600"
                      )}
                    >
                      {alerta.valor}
                      {isTemp ? "°C" : "%"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-foreground/50 uppercase tracking-wider mb-1">
                      Limite Máximo
                    </p>
                    <p className="text-2xl font-mono text-foreground/40 font-bold">
                      {isTemp ? "> " : "< "}
                      {alerta.limite}
                      {isTemp ? "°C" : "%"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 flex justify-between text-xs text-foreground/70 font-bold">
                  <span className="flex items-center gap-1">
                    📅{" "}
                    {alerta.criadoEm
                      ? format(new Date(alerta.criadoEm), "dd 'de' MMMM, yyyy")
                      : "Data indisponível"}
                  </span>
                  <span className="text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />{" "}
                    Atuador automático engajado
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}