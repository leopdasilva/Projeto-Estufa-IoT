# Projeto-Estufa-IoT

Um projeto de IoT desenvolvido no SENAI para transformar uma estufa convencional em um ambiente monitorado e automatizado em tempo real.

# 🌱 Estufa IoT

Sistema de monitoramento e automação de uma estufa utilizando **ESP32-S3**, sensores, atuadores, comunicação Wi-Fi, protocolo **MQTT**, banco de dados PostgreSQL e dashboard web em tempo real.

O sistema realiza a leitura das condições da estufa, executa regras de automação localmente na ESP32-S3 e publica as medições via MQTT para viabilizar visualizações e alertas instantâneos no dashboard.

---

## 📋 Sobre o projeto

A **Estufa IoT** foi desenvolvida para monitorar as condições ambientais de uma estufa e automatizar ações de irrigação e ventilação de acordo com os valores obtidos pelos sensores.

A ESP32-S3 é responsável por:

* Ler temperatura e umidade (DHT11);
* Ler luminosidade (LDR);
* Ler o nível de água (Potenciômetro/Sensor analógico);
* Controlar a bomba de irrigação (LED);
* Controlar o buzzer de alerta (Frequências de alta e baixa temperatura via PWM nativo);
* Exibir informações no LCD 16x2 I2C;
* Enviar as medições para a nuvem em tempo real via **MQTT (Publish/Subscribe)**.

---

# ⚡ Evolução do Protocolo: De HTTP/HTTPS para MQTT

Inicialmente, o projeto utilizava requisições **HTTP POST (HTTPS)** síncronas para enviar os dados dos sensores para uma API REST.

### Por que mudamos para o MQTT?

* **Atraso na Transmissão (Overhead):** O handshake TLS/HTTPS e o protocolo HTTP exigiam o envio recorrente de cabeçalhos volumosos e a abertura/fechamento constante de conexões TCP, causando latência perceptível no dashboard e lentidão na simulação.
* **Comunicação em Tempo Real (Sub-segundo):** O **MQTT (Message Queuing Telemetry Transport)** é um protocolo extremamente leve baseado na arquitetura *Publish/Subscribe*.
* **Melhor Desempenho e Menor Consumo:** A troca de payload JSON via Broker MQTT reduziu a latência de transmissão para menos de **50ms**, permitindo atualizações instantâneas no dashboard sem bloquear a execução das regras de automação na ESP32-S3.

---

# 🏗️ Arquitetura

```text
┌──────────────────────────┐
│         ESP32-S3         │
│                          │
│        DHT11 (T/U)       │
│        LDR (Luz)         │
│   Sensor Nível de Água   │
│                          │
│   Bomba (LED)   Buzzer   │
│        LCD 16x2          │
└────────────┬─────────────┘
             │
             │ Wi-Fi (TCP 1883)
             │ MQTT Publish (JSON)
             ▼
┌──────────────────────────┐
│      MQTT Broker         │
│   (broker.hivemq.com)    │
└────────────┬─────────────┘
             │
             │ WebSockets (TCP 8083/8084)
             │ MQTT Subscribe
             ▼
┌──────────────────────────┐
│      Dashboard Web       │
│    React + TypeScript    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     API / PostgreSQL     │
│   Histórico e Alertas    │
└──────────────────────────┘

```

A automação dos atuadores é realizada **localmente na ESP32-S3**, não dependendo da conexão com a nuvem para ligar ou desligar a bomba de irrigação e o alarme sonoro.

---

# 🔧 Hardware

## Componentes

| Componente | Função |
| --- | --- |
| ESP32-S3 | Unidade principal de controle |
| DHT11 | Temperatura e umidade |
| LDR | Medição de luminosidade |
| Potenciômetro | Simulação do nível de água |
| LED | Simulação da bomba de irrigação |
| Buzzer | Alarme de temperatura |
| LCD 16x2 I2C | Exibição local das informações |

---

# 📍 Mapeamento dos pinos (ESP32-S3)

| Componente | GPIO | Função |
| --- | --- | --- |
| DHT11 | 10 | Temperatura e umidade |
| LDR | 5 | Luminosidade (ADC1) |
| Potenciômetro | 4 | Nível de água (ADC1) |
| LED | 1 | Bomba de irrigação |
| Buzzer | 46 | Alarme (PWM Nativo) |
| LCD SDA | 8 | I2C |
| LCD SCL | 9 | I2C |

---

# ⚙️ Funcionamento da automação

As regras de automação são executadas de forma contínua e não-bloqueante (`millis()`) diretamente pela ESP32-S3.

## 💧 Controle da irrigação

O valor analógico do sensor de água é convertido para uma porcentagem de **0 a 100%**.

Quando o nível de água fica abaixo de 30%, o LED é acionado para representar a bomba de irrigação.

```text
Nível de água < 30%  ──►  Bomba LIGADA
Nível de água ≥ 30%  ──►  Bomba DESLIGADA

```

### Código de Automação

```cpp
if (aguaPct < AGUA_LIMITE_BAIXO) {
    digitalWrite(LEDPIN, HIGH);
} else {
    digitalWrite(LEDPIN, LOW);
}

```

---

# 🌡️ Controle de temperatura

O buzzer é controlado via PWM nativo da ESP32-S3 (`ledcWriteTone`), evitando travamentos do processador.

* **Temperatura > 30 °C:** Dispara alarme de alta temperatura a **1000 Hz**.
* **Temperatura < 0 °C:** Dispara alarme de congelamento/frio a **600 Hz**.
* **Entre 0 °C e 30 °C:** Temperatura segura (Buzzer desligado - **0 Hz**).

---

# 🖥️ Display LCD

O LCD 16x2 I2C apresenta continuamente as informações em tempo real:

```text
T:27.5°C U:62%
Agua:45% L:1830

```

---

# 📡 Comunicação MQTT

A ESP32-S3 conecta-se à rede Wi-Fi e estabelece uma conexão TCP persistente com o Broker MQTT.

* **Broker Público:** `broker.hivemq.com`
* **Porta:** `1883`
* **Tópico Publicado:** `senai/estufa/iot/leituras`
* **Frequência de Envio:** A cada 1 segundo (1000ms) em tempo real.

---

# 📦 Payload JSON Enviado

A ESP32-S3 publica as leituras em formato JSON padronizado:

```json
{
  "temperatura": 27.5,
  "umidade": 62.0,
  "nivelAgua": 45,
  "aguaPct": 45,
  "luminosidade": 1830,
  "luz": 1830
}

```

---

# 💻 Tecnologias

## Firmware / Hardware

* C++ (Arduino Framework)
* ESP32-S3
* Comunicação Wi-Fi
* Protocolo MQTT (`PubSubClient`)
* Controle de PWM Nativo (`ledcWriteTone`)

### Bibliotecas Utilizadas

* `Wire.h`
* `LiquidCrystal_I2C.h`
* `DHT.h`
* `WiFi.h`
* `PubSubClient.h`

---

## Frontend & Dashboard

* React + TypeScript
* Vite
* Tailwind CSS
* Lucide React
* Recharts
* MQTT via WebSockets (`paho-mqtt` / `mqtt.js`)

---


# 🚀 Como Executar o Firmware

1. Abra a pasta do firmware na **Arduino IDE**.
2. Certifique-se de selecionar a placa **ESP32-S3 Dev Module**.
3. Instale as bibliotecas requeridas:
* **PubSubClient** (por Nick O'Leary)
* **DHT sensor library**
* **LiquidCrystal_I2C**


4. Configure as credenciais de Wi-Fi no arquivo `.ino`:
```cpp
const char* ssid     = "NOME_DA_SUA_REDE";
const char* password = "SENHA_DA_SUA_REDE";

```


5. Faça o upload do firmware para a ESP32-S3.

---

# 🔄 Fluxo Completo de Funcionamento

```text
1. ESP32-S3 inicializa I2C, LCD, Sensores e PWM do Buzzer
                    ↓
2. Conecta-se à rede Wi-Fi e ao Broker MQTT (HiveMQ)
                    ↓
3. Leitura dos sensores (DHT11, LDR e Potenciômetro)
                    ↓
4. Executa regras de automação locais (Atua no LED e Buzzer)
                    ↓
5. Atualiza display LCD 16x2 localmente
                    ↓
6. Monta e publica o payload JSON no tópico MQTT
                    ↓
7. Broker repassa a mensagem via WebSockets ao Dashboard React em < 50ms
                    ↓
8. Repete o ciclo a cada 1 segundo (não-bloqueante via millis())

```
