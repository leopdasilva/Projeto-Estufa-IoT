#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h> 

// --- CONFIGURAÇÕES DE REDE ---
const char* ssid     = "Wokwi-GUEST"; 
const char* password = "";            

// --- CONFIGURAÇÕES MQTT ---
const char* MQTT_BROKER    = "broker.hivemq.com";  
const int   MQTT_PORT      = 1883;                  
const char* MQTT_TOPIC     = "senai/estufa/iot/leituras"; 

// --- MAPEAMENTO DOS PINOS ---
#define DHTPIN     10   
#define DHTTYPE    DHT22
#define LDRPIN     11   // GPIO 11
#define WATERPIN   12   // GPIO 12
#define LEDPIN     1    
#define BUZZERPIN  46   

#define SDA_PIN    6    
#define SCL_PIN    7    

// --- PERIFÉRICOS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- LIMITES DE AUTOMAÇÃO ---
const float TEMP_LIMITE = 30.0;     
const float TEMP_ABAIXO = 0.0;      
const int AGUA_LIMITE_BAIXO = 30;   

// --- GERENCIAMENTO DE TEMPOS OTIMIZADO ---
unsigned long tempoUltimoLCD = 0;
const unsigned long intervaloLCD = 1000; // Atualiza LCD a cada 1s (não pesa no Wokwi)

unsigned long tempoUltimoMQTT = 0;
const unsigned long intervaloMQTT = 1000; // Envia MQTT a cada 1s (Rápido!)

unsigned long tempoUltimoMqttTentativa = 0; 

// Variáveis de leituras
float temperatura = 0.0;
float umidade = 0.0;
float luminosidade = 0.0; 
int nivelAgua = 0;

void verificarConexaoMQTT() {
  if (!mqttClient.connected()) {
    if (millis() - tempoUltimoMqttTentativa >= 3000) {
      tempoUltimoMqttTentativa = millis();
      
      String clientId = "ESP32-Estufa-" + String(random(0xffff), HEX);
      
      Serial.print("Tentando conexão MQTT com ID ");
      Serial.print(clientId);
      Serial.print("... ");
      
      if (mqttClient.connect(clientId.c_str())) {
        Serial.println("conectado!");
      } else {
        Serial.print("falhou, rc=");
        Serial.println(mqttClient.state());
      }
    }
  }
}

void setup() {
  Serial.begin(115200);

  analogSetAttenuation(ADC_11db);
  Wire.begin(SDA_PIN, SCL_PIN);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("   Estufa IoT   ");
  lcd.setCursor(0, 1);
  lcd.print(" Conectando... ");

  pinMode(LEDPIN, OUTPUT);
  pinMode(BUZZERPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);
  noTone(BUZZERPIN);

  dht.begin();

  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(100);
    Serial.print(".");
  }

  Serial.println("\nWiFi Conectado!");
  lcd.clear();
  lcd.print("WiFi Conectado!");
  
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    verificarConexaoMQTT();
  }

  mqttClient.loop();

  unsigned long agora = millis();

  // 1. TAREFA LEVE: Leitura e Atualização da Interface (A cada 1 segundo)
  if (agora - tempoUltimoLCD >= intervaloLCD) {
    tempoUltimoLCD = agora;

    float tempLida = dht.readTemperature();
    float umidLida = dht.readHumidity();
    int valorLDR = analogRead(LDRPIN);
    int valorAgua = analogRead(WATERPIN);

    if (!isnan(tempLida) && !isnan(umidLida)) {
      temperatura = tempLida;
      umidade = umidLida;
    }

    // OTIMIZAÇÃO: Mapeamento linear super leve (Substituiu a função pow() travada)
    luminosidade = map(valorLDR, 0, 4095, 0, 5000); 

    // Cálculo Nível de Água (%)
    nivelAgua = map(valorAgua, 0, 4095, 0, 100);
    nivelAgua = constrain(nivelAgua, 0, 100);

    // Lógica de Atuação
    if (temperatura > TEMP_LIMITE || temperatura < TEMP_ABAIXO) {
      tone(BUZZERPIN, 1000); 
    } else {
      noTone(BUZZERPIN);    
    }

    if (nivelAgua < AGUA_LIMITE_BAIXO) {
      digitalWrite(LEDPIN, HIGH); 
    } else {
      digitalWrite(LEDPIN, LOW);  
    }

    // Exibição no LCD
    lcd.setCursor(0, 0);
    lcd.print("T:" + String(temperatura, 1) + "C U:" + String(umidade, 0) + "%   ");
    
    lcd.setCursor(0, 1);
    lcd.print("L:" + String((int)luminosidade) + "lx A:" + String(nivelAgua) + "%    ");
  }

  // 2. ENVIO MQTT EM TEMPO REAL (A cada 1 segundo)
  if (mqttClient.connected() && (agora - tempoUltimoMQTT >= intervaloMQTT)) {
    tempoUltimoMQTT = agora;

    Serial.printf("[MQTT] Enviando -> Temp: %.1f°C | Umid: %.1f%% | Luz: %.0f lx | Agua: %d%%\n", 
                  temperatura, umidade, luminosidade, nivelAgua);

    // Envio com chaves padronizadas
    String jsonPayload = "{\"temperatura\":" + String(temperatura, 1) + 
                         ",\"umidade\":" + String(umidade, 1) + 
                         ",\"luminosidade\":" + String(luminosidade, 0) + 
                         ",\"nivelAgua\":" + String(nivelAgua) + "}";

    mqttClient.publish(MQTT_TOPIC, jsonPayload.c_str());
  }
}