import { useState, useEffect, useCallback } from 'react';
import {
  initMqtt,
  subscribeToTopic,
  publishToTopic,
  onMqttStatusChange,
  getMqttStatus,
  type MqttStatus,
  TOPIC_LEITURAS,
} from './mqtt-client';

// ── Tipos de dados ───────────────────────────────────────────────────────────
export interface Leitura {
  id: number;
  temperatura: number;
  umidade: number;
  aguaPct: number;
  nivelAgua?: number;
  luz: number;
  luminosidade?: number;
  bombaLigada: boolean;
  exaustorLigado: boolean;
  criadoEm: string;
}

export interface EstufaStats {
  tempMedia: number;
  tempMax: number;
  aguaMedia: number;
  totalLeituras: number;
}

export interface Alerta {
  id: number;
  tipo: 'TEMP_ALTA' | 'AGUA_BAIXA';
  valor: number;
  limite: number;
  criadoEm: string;
}

// ── Constantes de armazenamento local (histórico) ────────────────────────────
const STORAGE_LEITURAS = '@estufa/leituras';
const STORAGE_ALERTAS  = '@estufa/alertas';
const MAX_LEITURAS     = 100;

// Inicializa MQTT ao importar este módulo
initMqtt();

// ── Helpers de localStorage ──────────────────────────────────────────────────
function getLeituras(): Leitura[] {
  try {
    const data = localStorage.getItem(STORAGE_LEITURAS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function pushLeitura(l: Leitura): void {
  const list = getLeituras();
  list.push(l);
  if (list.length > MAX_LEITURAS) list.splice(0, list.length - MAX_LEITURAS);
  localStorage.setItem(STORAGE_LEITURAS, JSON.stringify(list));
}

function getAlertas(): Alerta[] {
  try {
    const data = localStorage.getItem(STORAGE_ALERTAS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function pushAlerta(a: Alerta): void {
  const list = getAlertas();
  list.unshift(a);
  if (list.length > 50) list.splice(50);
  localStorage.setItem(STORAGE_ALERTAS, JSON.stringify(list));
}

// ── Processamento da mensagem MQTT recebida do ESP32 / Simulador ────────────
function processMqttPayload(raw: any): Leitura {
  // Extrai com fallback para os nomes do ESP32 (nivelAgua, luminosidade) e do React (aguaPct, luz)
  const tempVal = Number(raw.temperatura ?? raw.temp ?? 0);
  const umidVal = Number(raw.umidade ?? raw.umid ?? 0);
  const aguaVal = Number(raw.nivelAgua ?? raw.aguaPct ?? raw.agua ?? 0);
  const luzVal  = Number(raw.luminosidade ?? raw.luz ?? raw.lux ?? 0);

  const leitura: Leitura = {
    id:          Date.now(),
    temperatura: tempVal,
    umidade:     umidVal,
    aguaPct:     aguaVal,
    nivelAgua:   aguaVal,
    luz:         luzVal,
    luminosidade: luzVal,
    bombaLigada: raw.bombaLigada ?? (aguaVal < 30),
    exaustorLigado: raw.exaustorLigado ?? (tempVal > 30),
    criadoEm:    raw.criadoEm ?? new Date().toISOString(),
  };

  pushLeitura(leitura);

  // Gera alertas automáticos com base nos limites
  if (leitura.temperatura > 30) {
    pushAlerta({
      id:       Date.now(),
      tipo:     'TEMP_ALTA',
      valor:    leitura.temperatura,
      limite:   30,
      criadoEm: leitura.criadoEm,
    });
  }
  if (leitura.aguaPct < 30) {
    pushAlerta({
      id:       Date.now() + 1,
      tipo:     'AGUA_BAIXA',
      valor:    leitura.aguaPct,
      limite:   30,
      criadoEm: leitura.criadoEm,
    });
  }

  return leitura;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** Status da conexão MQTT em tempo real */
export function useMqttStatus(): MqttStatus {
  const [status, setStatus] = useState<MqttStatus>(getMqttStatus);
  useEffect(() => onMqttStatusChange(setStatus), []);
  return status;
}

/** Última leitura recebida do ESP32 via MQTT */
export function useGetLatestLeitura() {
  const stored = getLeituras();
  const [latest, setLatest] = useState<Leitura | null>(stored.length > 0 ? stored[stored.length - 1] : null);
  const [isLoading, setIsLoading] = useState(latest === null);

  useEffect(() => {
    return subscribeToTopic(TOPIC_LEITURAS, (raw) => {
      const leitura = processMqttPayload(raw);
      setLatest(leitura);
      setIsLoading(false);
    });
  }, []);

  return { data: latest, isLoading };
}

/** Estatísticas calculadas com base no histórico salvo */
export function useGetEstufaStats() {
  function compute(): EstufaStats {
    const list = getLeituras();
    if (!list.length) return { tempMedia: 0, tempMax: 0, aguaMedia: 0, totalLeituras: 0 };
    const temps = list.map((l) => l.temperatura);
    const aguas = list.map((l) => l.aguaPct);
    return {
      tempMedia:     temps.reduce((a, b) => a + b, 0) / temps.length,
      tempMax:       Math.max(...temps),
      aguaMedia:     aguas.reduce((a, b) => a + b, 0) / aguas.length,
      totalLeituras: list.length,
    };
  }

  const [stats, setStats] = useState<EstufaStats>(compute);

  useEffect(() => {
    return subscribeToTopic(TOPIC_LEITURAS, () => setStats(compute()));
  }, []);

  return { data: stats };
}

/**
 * Histórico de leituras em ordem cronológica (mais antigo → mais recente).
 */
export function useListLeituras(params?: { limite?: number }) {
  const limite = params?.limite ?? 100;

  function getSlice(): Leitura[] {
    return getLeituras().slice(-limite);
  }

  const [leituras, setLeituras] = useState<Leitura[]>(getSlice);

  useEffect(() => {
    return subscribeToTopic(TOPIC_LEITURAS, () => setLeituras(getSlice()));
  }, [limite]);

  return { data: leituras, isLoading: false };
}

/** Histórico de alertas gerados */
export function useListAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>(getAlertas);

  useEffect(() => {
    return subscribeToTopic(TOPIC_LEITURAS, () => setAlertas(getAlertas()));
  }, []);

  return { data: alertas, isLoading: false };
}

/**
 * Publica uma leitura simulada no broker MQTT.
 */
export function useCreateLeitura() {
  const [isPending, setIsPending] = useState(false);

  const mutate = useCallback(
    (
      args: { data: any },
      callbacks?: { onSuccess?: () => void }
    ) => {
      setIsPending(true);
      
      const tempVal = Number(args.data.temperatura ?? 0);
      const aguaVal = Number(args.data.nivelAgua ?? args.data.aguaPct ?? 0);
      const luzVal  = Number(args.data.luminosidade ?? args.data.luz ?? 0);

      const payload = {
        temperatura: tempVal,
        umidade:     Number(args.data.umidade ?? 0),
        nivelAgua:   aguaVal,
        aguaPct:     aguaVal,
        luminosidade: luzVal,
        luz:         luzVal,
        bombaLigada:    aguaVal < 30,
        exaustorLigado: tempVal > 30,
        criadoEm:       new Date().toISOString(),
      };

      publishToTopic(TOPIC_LEITURAS, payload);
      setIsPending(false);
      callbacks?.onSuccess?.();
    },
    []
  );

  return { mutate, isPending };
}

export type { MqttStatus };