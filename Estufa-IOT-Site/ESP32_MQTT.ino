#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>

// --- CONFIGURAÇÕES DE REDE ---
const char* ssid     = "DIGITE_SUA_REDE";  // Nome exato da sua rede ou Wi-Fi do Celular
const char* password = "DIGITE_SUA_SENHA"; // Senha da sua rede

// --- CONFIGURAÇÕES MQTT (Nuvem Gratuita e Ultrarrápida) ---
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "senai/estufa/iot/leituras";

// --- MAPEAMENTO DOS PINOS MANTIDO (ESP32-S3) ---
#define DHTPIN     10   // Pino de dados do DHT11
#define DHTTYPE    DHT11
#define LDRPIN     5    // Pino analógico do LDR
#define WATERPIN   4    // Pino analógico do Potenciômetro
#define LEDPIN     1    // Pino do LED (Simula Bomba de Irrigação)
#define BUZZERPIN  46   // Pino Buzzer

#define SDA_PIN    8    // Pino I2C SDA da ESP32-S3
#define SCL_PIN    9    // Pino I2C SCL da ESP32-S3

// --- CONFIGURAÇÃO DOS PERIFÉRICOS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- LIMITES DA ESTUFA PARA AUTOMAÇÃO ---
const float TEMP_LIMITE = 30.0;     // Temperatura > 30°C dispara exaustor (Buzzer)
const float TEMP_ABAIXO = 0.0;      // Temperatura < 0°C dispara exaustor (Buzzer)
const int AGUA_LIMITE_BAIXO = 30;   // limite de água para acender o LED

// --- GERENCIAMENTO DE TEMPOS SEM TRANCAR A PLACA ---
unsigned long tempoUltimoLoop = 0;
const unsigned long intervaloLeitura = 1000; // Lê sensores e publica MQTT a cada 1 segundo (1000ms)

unsigned long tempoUltimoMqttTentativa = 0;

// Variáveis Globais
float temp = 0.0;
float umid = 0.0;
int aguaPct = 0;
int luz = 0;

// Reconexão Automática ao Broker MQTT sem travar a execução
void verificarConexaoMQTT() {
  if (!mqttClient.connected()) {
    unsigned long agora = millis();
    if (agora - tempoUltimoMqttTentativa >= 3000) {
      tempoUltimoMqttTentativa = agora;
      
      String clientId = "ESP32S3-Estufa-" + String(random(0xffff), HEX);
      Serial.print("Conectando ao Broker MQTT...");
      
      if (mqttClient.connect(clientId.c_str())) {
        Serial.println(" CONECTADO COM SUCESSO!");
      } else {
        Serial.print(" Falhou, rc=");
        Serial.println(mqttClient.state());
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Inicialização dos pinos I2C específicos da ESP32-S3
  Wire.begin(SDA_PIN, SCL_PIN);

  // Inicialização do LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("   Estufa IoT   ");
  lcd.setCursor(0, 1);
  lcd.print(" Conectando... ");

  // Inicialização dos Atuadores
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);
  
  // Configuração nativa de PWM para o Buzzer na ESP32-S3 (Evita travamentos)
  ledcAttach(BUZZERPIN, 1000, 8); 
  ledcWriteTone(BUZZERPIN, 0); // Inicia desligado

  // Inicialização do DHT11
  dht.begin();

  // Inicialização do Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectado!");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  Sistema OK  ");
  
  // Configuração do servidor MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  // Garante reconexão Wi-Fi e MQTT transparentes
  if (WiFi.status() == WL_CONNECTED) {
    verificarConexaoMQTT();
  }
  mqttClient.loop();

  unsigned long tempoAtual = millis();

  // --- EXECUTADO A CADA 1 SEGUNDO (TEMPO REAL) ---
  if (tempoAtual - tempoUltimoLoop >= intervaloLeitura) {
    tempoUltimoLoop = tempoAtual;

    // 1. LEITURA DOS SENSORES
    float tempLida = dht.readTemperature();
    float umidLida = dht.readHumidity();

    if (!isnan(tempLida) && !isnan(umidLida)) {
      temp = tempLida;
      umid = umidLida;
    }

    int leituraBrutaAgua = analogRead(WATERPIN);
    aguaPct = map(leituraBrutaAgua, 0, 4095, 0, 100);
    aguaPct = constrain(aguaPct, 0, 100);

    luz = analogRead(LDRPIN);

    // 2. LÓGICA DE AUTOMAÇÃO (Bomba e Buzzer)
    if (aguaPct < AGUA_LIMITE_BAIXO) {
      digitalWrite(LEDPIN, HIGH); // Liga bomba/LED
    } else {
      digitalWrite(LEDPIN, LOW);  // Desliga
    }

    if (temp > TEMP_LIMITE) {
      ledcWriteTone(BUZZERPIN, 1000); // Alarme de calor
    } else if (temp < TEMP_ABAIXO) {
      ledcWriteTone(BUZZERPIN, 600);  // Alarme de frio
    } else {
      ledcWriteTone(BUZZERPIN, 0);    // Temperatura OK
    }

    // 3. EXIBIÇÃO NO LCD (Com limpeza de resíduos)
    lcd.setCursor(0, 0);
    lcd.print("T:");
    lcd.print(temp, 1);
    lcd.print((char)223);
    lcd.print("C U:");
    lcd.print(umid, 0);
    lcd.print("%   ");

    lcd.setCursor(0, 1);
    lcd.print("Agua:");
    lcd.print(aguaPct);
    lcd.print("% L:");
    lcd.print(luz);
    lcd.print("    ");

    // 4. TRANSMISSÃO SERIAL (DEBUG)
    Serial.printf("[ESP32-S3] Temp: %.1f°C | Umid: %.1f%% | Agua: %d%% | Luz: %d\n", 
                  temp, umid, aguaPct, luz);

    // 5. ENVIO DOS DADOS VIA MQTT (Super Rápido)
    if (mqttClient.connected()) {
      String payload = "{";
      payload += "\"temperatura\":" + String(temp, 1) + ",";
      payload += "\"umidade\":"     + String(umid, 1) + ",";
      payload += "\"nivelAgua\":"   + String(aguaPct) + ",";
      payload += "\"aguaPct\":"     + String(aguaPct) + ",";
      payload += "\"luminosidade\":" + String(luz)     + ",";
      payload += "\"luz\":"         + String(luz);
      payload += "}";

      mqttClient.publish(MQTT_TOPIC, payload.c_str());
    }
  }
}