import mqtt, { MqttClient } from 'mqtt';

// ── Broker público gratuito HiveMQ (sem cadastro necessário) ─────────────────
// Para produção, troque por: wss://SEU_CLUSTER.s1.eu.hivemq.cloud:8884/mqtt
export const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

// Tópico principal — use um prefixo único para evitar colisão com outros projetos
// O ESP32 deve publicar neste mesmo tópico!
export const TOPIC_LEITURAS = 'senai/estufa/iot/leituras';

// ── Status da conexão ────────────────────────────────────────────────────────
export type MqttStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
let currentStatus: MqttStatus = 'disconnected';
const statusListeners = new Set<(s: MqttStatus) => void>();

function emitStatus(s: MqttStatus) {
  currentStatus = s;
  statusListeners.forEach((fn) => fn(s));
}

export function onMqttStatusChange(cb: (s: MqttStatus) => void): () => void {
  statusListeners.add(cb);
  cb(currentStatus); // emite o estado atual imediatamente
  return () => statusListeners.delete(cb);
}

export function getMqttStatus(): MqttStatus {
  return currentStatus;
}

// ── Gerenciamento de mensagens por tópico ────────────────────────────────────
type MessageCallback = (payload: any) => void;
const topicListeners = new Map<string, Set<MessageCallback>>();

/**
 * Assina um tópico MQTT e retorna uma função para cancelar a assinatura.
 */
export function subscribeToTopic(topic: string, cb: MessageCallback): () => void {
  if (!topicListeners.has(topic)) {
    topicListeners.set(topic, new Set());
    // Se já conectado, assina agora; senão, será assinado ao conectar
    if (mqttClient?.connected) {
      mqttClient.subscribe(topic, { qos: 1 });
    }
  }
  topicListeners.get(topic)!.add(cb);

  return () => {
    topicListeners.get(topic)?.delete(cb);
  };
}

/**
 * Publica uma mensagem JSON em um tópico MQTT.
 */
export function publishToTopic(topic: string, payload: object): void {
  if (!mqttClient?.connected) {
    console.warn('[MQTT] Tentativa de publicar sem conexão ativa.');
    return;
  }
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
}

// ── Singleton do cliente MQTT ────────────────────────────────────────────────
let mqttClient: MqttClient | null = null;

/**
 * Inicializa a conexão MQTT (chamado uma única vez na inicialização do app).
 */
export function initMqtt(): void {
  if (mqttClient) return; // já inicializado
  emitStatus('connecting');

  mqttClient = mqtt.connect(BROKER_URL, {
    clientId: `estufa-web-${Date.now().toString(16).slice(-8)}`,
    clean: true,
    reconnectPeriod: 5000,   // tenta reconectar a cada 5s
    connectTimeout: 15000,   // timeout de 15s
    keepalive: 60,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Conectado ao broker:', BROKER_URL);
    emitStatus('connected');
    // Re-assina todos os tópicos ao reconectar
    topicListeners.forEach((_, topic) => {
      mqttClient!.subscribe(topic, { qos: 1 });
    });
  });

  mqttClient.on('reconnect', () => {
    console.log('[MQTT] Reconectando...');
    emitStatus('reconnecting');
  });

  mqttClient.on('disconnect', () => {
    console.log('[MQTT] Desconectado.');
    emitStatus('disconnected');
  });

  mqttClient.on('error', (e) => {
    console.error('[MQTT] Erro:', e.message);
    emitStatus('error');
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      topicListeners.get(topic)?.forEach((cb) => cb(payload));
    } catch {
      console.warn('[MQTT] Mensagem inválida recebida:', message.toString());
    }
  });
}
