/*
 * ============================================================
 *  Estufa IoT — ESP32 com MQTT
 *  SENAI — Projeto Internet das Coisas
 * ============================================================
 *
 *  BIBLIOTECAS NECESSÁRIAS (instale pelo Library Manager da Arduino IDE):
 *    - PubSubClient  by Nick O'Leary   (MQTT)
 *    - ArduinoJson   by Benoit Blanchon
 *    - DHT sensor library  by Adafruit
 *    - Adafruit Unified Sensor  by Adafruit
 *
 *  TÓPICO MQTT (deve ser o mesmo configurado no site React):
 *    senai/estufa/iot/leituras
 *
 * ============================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ── Configurações Wi-Fi ──────────────────────────────────────────────────────
const char* WIFI_SSID     = "SEU_WIFI_AQUI";       // ← Troque pelo nome da sua rede
const char* WIFI_PASSWORD = "SUA_SENHA_AQUI";      // ← Troque pela sua senha

// ── Configurações MQTT (HiveMQ público — sem cadastro) ───────────────────────
const char* MQTT_BROKER   = "broker.hivemq.com";   // Broker público gratuito
const int   MQTT_PORT     = 1883;                  // Porta padrão MQTT (sem TLS)
const char* MQTT_TOPIC    = "senai/estufa/iot/leituras"; // Mesmo tópico do site!
const char* MQTT_CLIENT_ID = "ESP32-Estufa-001";   // Troque se tiver múltiplos ESP32

// ── Pinos dos sensores ───────────────────────────────────────────────────────
#define DHT_PIN      4     // GPIO 4  — Sensor DHT22 (temperatura + umidade)
#define DHT_TYPE     DHT22
#define LDR_PIN      34    // GPIO 34 — Fotoresistor / LDR (luminosidade)
#define WATER_PIN    35    // GPIO 35 — Sensor de nível d'água (analógico)
#define PUMP_PIN     26    // GPIO 26 — Relé da bomba de irrigação
#define FAN_PIN      27    // GPIO 27 — Relé do exaustor / ventoinha

// ── Limites de controle automático ──────────────────────────────────────────
#define TEMP_MAX     30.0  // °C — acima disso, o exaustor é acionado
#define WATER_MIN    30    // %  — abaixo disso, a bomba é acionada

// ── Intervalo de publicação ──────────────────────────────────────────────────
#define PUBLISH_INTERVAL_MS  5000  // Publica dados a cada 5 segundos

// ── Objetos ──────────────────────────────────────────────────────────────────
DHT          dht(DHT_PIN, DHT_TYPE);
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastPublish = 0;

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n========================================");
  Serial.println("  Estufa IoT — Iniciando...");
  Serial.println("========================================");

  // Configura os pinos de saída
  pinMode(PUMP_PIN, OUTPUT);
  pinMode(FAN_PIN,  OUTPUT);
  digitalWrite(PUMP_PIN, LOW);  // Desliga bomba na inicialização
  digitalWrite(FAN_PIN,  LOW);  // Desliga exaustor na inicialização

  // Inicia o sensor DHT
  dht.begin();

  // Conecta ao Wi-Fi
  connectWiFi();

  // Configura o cliente MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setBufferSize(512); // Buffer para mensagens JSON maiores
}

// ============================================================
//  LOOP PRINCIPAL
// ============================================================
void loop() {
  // Garante conexão MQTT ativa
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Publica leitura no intervalo configurado
  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = now;
    lerEPublicar();
  }
}

// ============================================================
//  LER SENSORES E PUBLICAR VIA MQTT
// ============================================================
void lerEPublicar() {
  // -- Temperatura e umidade (DHT22) --
  float temperatura = dht.readTemperature();
  float umidade     = dht.readHumidity();

  if (isnan(temperatura) || isnan(umidade)) {
    Serial.println("[ERRO] Falha na leitura do DHT22! Verifique a ligação.");
    return;
  }

  // -- Nível do reservatório (0-4095 → 0-100%) --
  // Sensor de nível analógico: mais água = maior tensão (ajuste se necessário)
  int rawWater = analogRead(WATER_PIN);
  int aguaPct  = map(rawWater, 0, 4095, 0, 100);
  aguaPct      = constrain(aguaPct, 0, 100);

  // -- Luminosidade (LDR → lux aproximado) --
  // LDR: mais luz = maior resistência = menor tensão (depende do divisor de tensão)
  int rawLDR = analogRead(LDR_PIN);
  int luz    = map(rawLDR, 0, 4095, 0, 10000); // 0 a 10.000 lux (ajuste conforme seu sensor)

  // -- Controle automático dos atuadores --
  bool bombaLigada    = (aguaPct < WATER_MIN);     // Liga bomba se água < 30%
  bool exaustorLigado = (temperatura > TEMP_MAX);  // Liga exaustor se temp > 30°C

  digitalWrite(PUMP_PIN, bombaLigada    ? HIGH : LOW);
  digitalWrite(FAN_PIN,  exaustorLigado ? HIGH : LOW);

  // -- Monta o payload JSON --
  // IMPORTANTE: os nomes dos campos DEVEM ser iguais aos do site React
  StaticJsonDocument<256> doc;
  doc["temperatura"]     = temperatura;
  doc["umidade"]         = (int)umidade;
  doc["aguaPct"]         = aguaPct;
  doc["luz"]             = luz;
  doc["bombaLigada"]     = bombaLigada;
  doc["exaustorLigado"]  = exaustorLigado;

  char payload[256];
  serializeJson(doc, payload);

  // -- Exibe no Monitor Serial --
  Serial.println("----------------------------------------");
  Serial.printf("  Temp:      %.1f °C\n",  temperatura);
  Serial.printf("  Umidade:   %d %%\n",    (int)umidade);
  Serial.printf("  Água:      %d %%\n",    aguaPct);
  Serial.printf("  Luz:       %d lx\n",   luz);
  Serial.printf("  Bomba:     %s\n",       bombaLigada    ? "LIGADA" : "desligada");
  Serial.printf("  Exaustor:  %s\n",       exaustorLigado ? "LIGADO" : "desligado");
  Serial.printf("  Payload:   %s\n",       payload);

  // -- Publica no broker MQTT --
  if (mqttClient.publish(MQTT_TOPIC, payload, false)) {
    Serial.println("  [MQTT] ✓ Publicado com sucesso!");
  } else {
    Serial.println("  [MQTT] ✗ Falha ao publicar!");
  }
}

// ============================================================
//  CONEXÃO WI-FI
// ============================================================
void connectWiFi() {
  Serial.printf("[Wi-Fi] Conectando a: %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativas = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++tentativas > 30) {
      Serial.println("\n[Wi-Fi] ERRO: Não foi possível conectar. Reiniciando...");
      ESP.restart();
    }
  }

  Serial.println();
  Serial.printf("[Wi-Fi] ✓ Conectado!  IP: %s\n", WiFi.localIP().toString().c_str());
  Serial.printf("[Wi-Fi]   RSSI: %d dBm\n", WiFi.RSSI());
}

// ============================================================
//  RECONEXÃO MQTT
// ============================================================
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.printf("[MQTT] Conectando ao broker %s:%d...", MQTT_BROKER, MQTT_PORT);

    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println(" ✓ Conectado!");
    } else {
      Serial.printf(" ✗ Falhou (rc=%d). Tentando novamente em 5s...\n", mqttClient.state());
      delay(5000);
    }
  }
}
