#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --- CONFIGURAÇÕES DE REDE E API (REPLIT) ---
const char* ssid     = "DIGITE_SUA_REDE"; // Digite o nome exato da sua rede
const char* password = "DIGITE_SUA_SENHA";     // Digite a senha da sua rede


// Substitua pela URL final do seu app publicado no Replit
const char* serverUrl = "https://greenhouse-monitor.replit.app/api/estufa/leitura";

// --- MAPEAMENTO DOS PINOS (ESP32-S3) ---
#define DHTPIN     10   // Pino de dados do DHT11
#define DHTTYPE    DHT11  // Corrigido para o seu DHT11
#define LDRPIN     5    // Pino analógico do LDR (ADC1 - Seguro com Wi-Fi)
#define WATERPIN   4    // Pino analógico do Potenciômetro (ADC1 - Seguro com Wi-Fi)
#define LEDPIN     1    // Pino do LED (Simula Bomba de Irrigação)
#define BUZZERPIN  46   // Pino Buzzer

#define SDA_PIN    8    // Pino I2C SDA da ESP32-S3
#define SCL_PIN    9    // Pino I2C SCL da ESP32-S3

// --- CONFIGURAÇÃO DOS PERIFÉRICOS ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

// --- LIMITES DA ESTUFA PARA AUTOMAÇÃO ---
const float TEMP_LIMITE = 30.0;     // Temperatura > 30°C dispara exaustor (Buzzer)
const float TEMP_ABAIXO = 0.0;      // Temperatura < 0°C dispara exaustor (Buzzer)
const int AGUA_LIMITE_BAIXO = 30;   // limite de água para acender o LED

void setup() {
  Serial.begin(115200);

  // Inicialização dos pinos I2C específicos da ESP32-S3
  Wire.begin(SDA_PIN, SCL_PIN);

  // Inicialização do LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("  Estufa IoT  ");
  lcd.setCursor(0, 1);
  lcd.print(" Conectando... ");

  // Inicialização dos Atuadores
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);
  
  // Configuração nativa de PWM para o Buzzer na ESP32-S3 (Evita travamentos do tone)
  ledcAttach(BUZZERPIN, 1000, 8); 
  ledcWriteTone(BUZZERPIN, 0); // Inicia desligado

  // Inicialização do DHT11
  dht.begin();

  // Inicialização do Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectado!");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("  Sistema OK  ");
  delay(1500);
  lcd.clear();
}

void loop() {
  // --- LEITURA DOS SENSORES ---
  float temp = dht.readTemperature();
  float umid = dht.readHumidity();
  
  // Leitura analógica bruta do Potenciômetro (0 a 4095) e conversão em %
  int leituraBrutaAgua = analogRead(WATERPIN);
  int aguaPct = map(leituraBrutaAgua, 0, 4095, 0, 100);
  
  int luz = analogRead(LDRPIN);

  // Verificação de erro de leitura do DHT11
  if (isnan(temp) || isnan(umid)) {
    Serial.println("Falha ao ler o sensor DHT11!");
    return;
  }

  // --- LÓGICA DE AUTOMAÇÃO ---

  // 1. Controle da Irrigação (LED) baseado em Porcentagem 
  if (aguaPct < AGUA_LIMITE_BAIXO) {
    digitalWrite(LEDPIN, HIGH); // Liga bomba/LED
  } else {
    digitalWrite(LEDPIN, LOW);  // Desliga
  }

  // 2. Controle do Exaustor (Buzzer via PWM Nativo)
  if (temp > TEMP_LIMITE) {
    // Alarme de calor
    ledcWriteTone(BUZZERPIN, 1000);
  }
  else if (temp < TEMP_ABAIXO) {
    // Alarme de frio (sirene)
    for (int freq = 500; freq < 900; freq += 40) {
      ledcWriteTone(BUZZERPIN, freq);
      delay(15);
    }
  }
  else {
    // Temperatura segura
    ledcWriteTone(BUZZERPIN, 0);
  }

  // --- EXIBIÇÃO DE DADOS NO LCD ---
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(temp, 1);
  lcd.print((char)223); // Símbolo de graus °
  lcd.print("C U:");
  lcd.print(umid, 0);
  lcd.print("%  ");

  lcd.setCursor(0, 1);
  lcd.print("Agua:");
  lcd.print(aguaPct);
  lcd.print("% L:");
  lcd.print(luz);
  lcd.print("   "); // Espaços em branco para limpar resíduos visuais do número anterior

  // --- TRANSMISSÃO VIA SERIAL (DEBUG) ---
  Serial.print("Temp: "); Serial.print(temp); Serial.print(" °C | ");
  Serial.print("Umid: "); Serial.print(umid); Serial.print(" % | ");
  Serial.print("Agua: "); Serial.print(aguaPct); Serial.print(" % | ");
  Serial.print("Luz: "); Serial.println(luz);

  // --- ENVIO DOS DADOS VIA HTTP POST (REPLIT API) ---
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Ignora validação rigorosa SSL no Replit/Wokwi

    HTTPClient http;
    http.begin(client, serverUrl);
    
    // Define tempo limite de 5s para evitar travamento da placa caso a API falhe
    http.setTimeout(5000); 
    
    http.addHeader("Content-Type", "application/json");

    String payload = "{";
    payload += "\"temperatura\":" + String(temp, 1) + ",";
    payload += "\"umidade\":"     + String(umid, 1) + ",";
    payload += "\"aguaPct\":"     + String(aguaPct)  + ",";
    payload += "\"luz\":"         + String(luz);
    payload += "}";

    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
      Serial.print("Enviado para Replit! Resposta HTTP: ");
      Serial.println(httpCode);
    } else {
      Serial.print("Erro ao enviar POST: ");
      Serial.println(httpCode);
    }
    
    http.end();
  } else {
    Serial.println("Erro: Wi-Fi desconectado!");
  }

  // Intervalo estável para o DHT11 e para requisições na nuvem
  delay(2000); 
}
