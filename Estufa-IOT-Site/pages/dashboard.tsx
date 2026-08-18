import {
  useGetLatestLeitura,
  useGetEstufaStats,
  useListLeituras,
  useCreateLeitura,
  useMqttStatus,
} from "../src/lib/api-client";

import { Thermometer, Droplets, Sun, Wind, Zap, Activity, Waves } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { cn } from "../src/lib/utils";

export default function Dashboard() {
  const mqttStatus = useMqttStatus();
  const { data: latest, isLoading } = useGetLatestLeitura();
  const { data: stats } = useGetEstufaStats();
  const { data: history } = useListLeituras({ limite: 30 });
  const createLeitura = useCreateLeitura();

  // Mapeamento normalizado dos dados para garantir compatibilidade entre ESP32 e Simulador
  const nivelAguaValor = latest?.nivelAgua ?? latest?.aguaPct ?? "--";
  const luminosidadeValor = latest?.luminosidade ?? latest?.luz ?? "--";

  // Botão "Simular Leitura" — publica diretamente no broker MQTT padronizado com o ESP32
  const handleSimulate = () => {
    const isHot = Math.random() > 0.8;
    const isDry = Math.random() > 0.8;
    createLeitura.mutate({
      data: {
        temperatura: isHot
          ? parseFloat((31 + Math.random() * 5).toFixed(1))
          : parseFloat((22 + Math.random() * 6).toFixed(1)),
        umidade: Math.round(40 + Math.random() * 40),
        nivelAgua: isDry
          ? Math.round(15 + Math.random() * 10)
          : Math.round(40 + Math.random() * 60),
        luminosidade: Math.round(500 + Math.random() * 3000),
      },
    });
  };

  // Dados para o gráfico — ordem cronológica (mais antigo → mais recente)
  const chartData = Array.isArray(history)
    ? history.map((h: any) => ({
        time: h.criadoEm ? format(new Date(h.criadoEm), "HH:mm:ss") : "--:--:--",
        temp: h.temperatura,
        umid: h.umidade,
      }))
    : [];

  // Configuração visual do badge de status MQTT
  const statusConfig = {
    connected:    { label: "MQTT Online",    dot: "bg-success",     text: "text-success",     pulse: true  },
    connecting:   { label: "Conectando...",    dot: "bg-amber-500",   text: "text-amber-500",   pulse: true  },
    reconnecting: { label: "Reconectando...",  dot: "bg-amber-500",   text: "text-amber-500",   pulse: true  },
    disconnected: { label: "MQTT Offline",     dot: "bg-destructive", text: "text-destructive", pulse: false },
    error:        { label: "Erro de Conexão",  dot: "bg-destructive", text: "text-destructive", pulse: false },
  }[mqttStatus];

  if (isLoading && !latest) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-primary gap-4 animate-in fade-in">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="font-serif font-bold text-xl">Aguardando dados do ESP32...</p>
        <p className="text-sm text-foreground/60">
          Conectando ao broker MQTT — clique em "Simular Leitura" para testar.
        </p>
        <Button onClick={handleSimulate} variant="secondary" size="sm" className="gap-2 mt-2">
          <Activity className="w-4 h-4" /> Simular Leitura
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* CABEÇALHO */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-4xl font-black text-primary mb-2 tracking-tight">
            Visão Geral
          </h2>
          <p className="text-foreground/80 max-w-xl text-lg font-medium">
            Acompanhe os sinais vitais da sua estufa em tempo real via MQTT.
          </p>
          {/* Status MQTT */}
          <div className={cn("flex items-center gap-2 mt-2 text-xs font-mono font-bold", statusConfig.text)}>
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                statusConfig.dot,
                statusConfig.pulse && "animate-pulse"
              )}
            />
            {statusConfig.label}
          </div>
        </div>
        <Button
          onClick={handleSimulate}
          disabled={createLeitura.isPending}
          variant="secondary"
          className="gap-2 shadow-sm border border-border"
        >
          <Activity className="w-4 h-4" /> Simular Leitura
        </Button>
      </header>

      {/* CARDS DOS SENSORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Temperatura"
          value={latest?.temperatura ?? "--"}
          unit="°C"
          icon={Thermometer}
          alert={!!latest && latest.temperatura > 30}
        />
        <MetricCard
          title="Umidade do Ar"
          value={latest?.umidade ?? "--"}
          unit="%"
          icon={Wind}
        />
        <MetricCard
          title="Nível do Reservatório"
          value={nivelAguaValor}
          unit="%"
          icon={Droplets}
          alert={typeof nivelAguaValor === "number" && nivelAguaValor < 30}
        />
        <MetricCard
          title="Luminosidade"
          value={luminosidadeValor}
          unit=" lx"
          icon={Sun}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRÁFICO DE TEMPERATURA */}
        <Card className="lg:col-span-2 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle>Comportamento Térmico Recente</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-foreground/40 text-sm font-bold">
                Aguardando leituras do ESP32...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--foreground)/0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--foreground)/0.5)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontWeight: "bold",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    name="Temp (°C)"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorTemp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* SISTEMAS ATIVOS E BALANÇO 24H */}
        <div className="space-y-6 flex flex-col">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Sistemas Ativos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bomba */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 bg-background rounded-xl border transition-colors",
                  latest?.bombaLigada ? "border-blue-300" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-xl shadow-inner transition-colors",
                      latest?.bombaLigada
                        ? "bg-blue-500/20 text-blue-600"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Waves className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold font-sans">Bomba de Irrigação</p>
                    <p className="text-xs text-foreground/60 font-medium">
                      {latest?.bombaLigada ? "Irrigando solo agora" : "Em repouso"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={latest?.bombaLigada ? "default" : "secondary"}
                  className={cn(
                    latest?.bombaLigada &&
                      "bg-blue-500 hover:bg-blue-600 text-white shadow-md animate-pulse"
                  )}
                >
                  {latest?.bombaLigada ? "LIGADA" : "DESLIGADA"}
                </Badge>
              </div>

              {/* Exaustor */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 bg-background rounded-xl border transition-colors",
                  latest?.exaustorLigado ? "border-accent" : "border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-xl shadow-inner transition-colors",
                      latest?.exaustorLigado
                        ? "bg-accent/20 text-accent"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold font-sans">Exaustor</p>
                    <p className="text-xs text-foreground/60 font-medium">
                      {latest?.exaustorLigado ? "Resfriando estufa" : "Em repouso"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={latest?.exaustorLigado ? "default" : "secondary"}
                  className={cn(
                    latest?.exaustorLigado &&
                      "bg-accent hover:bg-accent/90 text-accent-foreground shadow-md animate-pulse"
                  )}
                >
                  {latest?.exaustorLigado ? "LIGADO" : "DESLIGADO"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Balanço 24h */}
          {stats && (
            <Card className="shadow-lg bg-primary text-primary-foreground border-none relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Activity className="w-32 h-32" />
              </div>
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-primary-foreground">Balanço 24h</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary-foreground/10 p-3 rounded-lg">
                    <p className="text-primary-foreground/70 text-xs font-sans font-bold">Média Temp.</p>
                    <p className="font-mono text-2xl mt-1">
                      {stats.tempMedia ? Number(stats.tempMedia).toFixed(1) : "0.0"}°C
                    </p>
                  </div>
                  <div className="bg-primary-foreground/10 p-3 rounded-lg">
                    <p className="text-primary-foreground/70 text-xs font-sans font-bold">Pico Temp.</p>
                    <p className="font-mono text-2xl mt-1">
                      {stats.tempMax ? Number(stats.tempMax).toFixed(1) : "0.0"}°C
                    </p>
                  </div>
                  <div className="bg-primary-foreground/10 p-3 rounded-lg">
                    <p className="text-primary-foreground/70 text-xs font-sans font-bold">Média Água</p>
                    <p className="font-mono text-2xl mt-1">
                      {stats.aguaMedia ? Number(stats.aguaMedia).toFixed(1) : "0.0"}%
                    </p>
                  </div>
                  <div className="bg-primary-foreground/10 p-3 rounded-lg">
                    <p className="text-primary-foreground/70 text-xs font-sans font-bold">Total Leituras</p>
                    <p className="font-mono text-2xl mt-1">{stats.totalLeituras ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Card reutilizável para cada sensor
function MetricCard({ title, value, unit, icon: Icon, alert }: any) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500 shadow-md group",
        alert
          ? "border-destructive"
          : "border-card-border hover:border-primary/50"
      )}
    >
      <div
        className={cn(
          "absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-15 blur-2xl transition-all duration-700",
          alert ? "bg-destructive opacity-30" : "bg-primary group-hover:scale-110"
        )}
      />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-sans font-bold text-foreground/80">{title}</CardTitle>
        <div
          className={cn(
            "p-2 rounded-lg shadow-inner",
            alert ? "bg-destructive/10 text-destructive" : "bg-background text-primary"
          )}
        >
          <Icon className={cn("w-5 h-5", alert && "animate-pulse")} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1 mt-2">
          <span
            className={cn(
              "text-5xl font-mono font-bold tracking-tighter",
              alert ? "text-destructive" : "text-foreground"
            )}
          >
            {value}
          </span>
          <span className="text-xl font-sans font-bold text-foreground/60">{unit}</span>
        </div>
        {alert ? (
          <p className="text-xs text-destructive font-bold mt-3 animate-in slide-in-from-bottom-2 bg-destructive/10 inline-block px-2 py-1 rounded-md">
            ⚠️ Atenção Imediata
          </p>
        ) : (
          <p className="text-xs text-success font-bold mt-3 animate-in slide-in-from-bottom-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> Níveis Normais
          </p>
        )}
      </CardContent>
    </Card>
  );
}