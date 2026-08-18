# Projeto-Estufa-IoT
Um projeto de IoT feito no SENAI para transformar uma estufa convencional em um ambiente monitorado e automatizado.

# 🌱 Estufa IoT

Sistema de monitoramento e automação de uma estufa utilizando **ESP32-S3**, sensores, atuadores, comunicação Wi-Fi, API REST, banco de dados PostgreSQL e dashboard web.

O sistema realiza a leitura das condições da estufa, executa regras de automação localmente na ESP32 e envia os dados para uma API para armazenamento e visualização no dashboard.

---

## 📋 Sobre o projeto

A **Estufa IoT** foi desenvolvida para monitorar as condições ambientais de uma estufa e automatizar algumas ações de acordo com os valores obtidos pelos sensores.

A ESP32-S3 é responsável por:

* Ler temperatura e umidade;
* Ler luminosidade;
* Ler o nível de água;
* Controlar a bomba de irrigação;
* Controlar o buzzer de alerta;
* Exibir informações no LCD;
* Enviar as medições para o servidor através de Wi-Fi.

Os dados recebidos pelo servidor podem ser armazenados no PostgreSQL e apresentados através de um dashboard web.

---

# 🏗️ Arquitetura

```text
┌──────────────────────────┐
│        ESP32-S3          │
│                          │
│        DHT11             │
│        LDR               │
│   Sensor de nível água   │
│                          │
│  Bomba      Buzzer       │
│                          │
│        LCD 16x2          │
└────────────┬─────────────┘
             │
             │ Wi-Fi
             │ HTTPS / JSON
             ▼
┌──────────────────────────┐
│          API             │
│     Node.js / Express    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│       PostgreSQL         │
│                          │
│        Leituras          │
│         Alertas          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        Dashboard         │
│      React + TypeScript  │
└──────────────────────────┘
```

A automação dos atuadores é realizada **localmente na ESP32**, não dependendo da resposta da API para ligar ou desligar a bomba e o buzzer.

---

# 🔧 Hardware

## Componentes

| Componente    | Função                          |
| ------------- | ------------------------------- |
| ESP32-S3      | Unidade principal de controle   |
| DHT11         | Temperatura e umidade           |
| LDR           | Medição de luminosidade         |
| Potenciômetro | Simulação do nível de água      |
| LED           | Simulação da bomba de irrigação |
| Buzzer        | Alarme de temperatura           |
| LCD 16x2 I2C  | Exibição das informações        |

---

# 📍 Mapeamento dos pinos

| Componente    | GPIO | Função                |
| ------------- | ---: | --------------------- |
| DHT11         |   10 | Temperatura e umidade |
| LDR           |    5 | Luminosidade          |
| Potenciômetro |    4 | Nível de água         |
| LED           |    1 | Bomba de irrigação    |
| Buzzer        |   46 | Alarme                |
| LCD SDA       |    8 | I2C                   |
| LCD SCL       |    9 | I2C                   |

---

# ⚙️ Funcionamento da automação

As regras de automação são executadas diretamente pela ESP32.

## 💧 Controle da irrigação

O valor do sensor de água é convertido para uma porcentagem de **0 a 100%**.

Quando o nível de água fica abaixo de 30%, o LED é acionado para representar a bomba de irrigação.

```text
Nível de água < 30%
        ↓
Bomba ligada
```

Quando o nível é igual ou superior a 30%:

```text
Nível de água ≥ 30%
        ↓
Bomba desligada
```

### Regra utilizada

```cpp
if (aguaPct < 30) {
    digitalWrite(LEDPIN, HIGH);
} else {
    digitalWrite(LEDPIN, LOW);
}
```

---

# 🌡️ Controle de temperatura

O buzzer possui três comportamentos diferentes.

### Temperatura acima de 30 °C

O buzzer é acionado em uma frequência de 1000 Hz.

```text
Temperatura > 30 °C
        ↓
Buzzer ligado
        ↓
1000 Hz
```

### Temperatura abaixo de 0 °C

É executada uma variação de frequência, criando um efeito de sirene.

```text
Temperatura < 0 °C
        ↓
Sirene
        ↓
500 Hz → 900 Hz
```

### Temperatura entre 0 °C e 30 °C

```text
0 °C ≤ temperatura ≤ 30 °C
        ↓
Buzzer desligado
```

---

# 🖥️ Display LCD

O LCD 16x2 apresenta continuamente as principais informações coletadas pela ESP32.

Exemplo:

```text
T:27.5°C U:62%
Agua:45% L:1830
```

São exibidos:

* Temperatura;
* Umidade;
* Nível de água;
* Luminosidade.

---

# 📡 Comunicação Wi-Fi

A ESP32 se conecta à rede Wi-Fi configurada no firmware.

Após estabelecer a conexão, as medições são enviadas para a API através de uma requisição HTTP POST utilizando HTTPS.

Endpoint utilizado:

```http
POST /api/estufa/leitura
```

URL configurada no firmware:

```text
https://greenhouse-monitor.replit.app/api/estufa/leitura
```

---

# 📦 Dados enviados para a API

A ESP32 envia os dados no formato JSON.

Exemplo:

```json
{
  "temperatura": 27.5,
  "umidade": 62.0,
  "aguaPct": 45,
  "luz": 1830
}
```

### Campos

| Campo         | Descrição                     |
| ------------- | ----------------------------- |
| `temperatura` | Temperatura em °C             |
| `umidade`     | Umidade relativa do ar em %   |
| `aguaPct`     | Nível de água em %            |
| `luz`         | Valor analógico do sensor LDR |

A transmissão ocorre aproximadamente a cada **2 segundos**.

---

# 🖥️ Dashboard

O projeto possui um dashboard web para visualização das informações da estufa.

O dashboard apresenta informações como:

* Temperatura;
* Umidade;
* Nível de água;
* Luminosidade;
* Histórico das leituras;
* Alertas;
* Gráficos;
* Estatísticas das medições.

## Visão geral

A tela principal permite acompanhar as condições atuais da estufa e visualizar os dados de forma gráfica.

## Histórico

Permite consultar as medições armazenadas no banco de dados.

## Alertas

Apresenta os alertas registrados pelo sistema, como situações relacionadas à temperatura e ao nível de água.

---

# 🌐 API

A API é responsável por receber, processar e disponibilizar os dados da estufa.

## Enviar leitura

```http
POST /api/estufa/leitura
```

Recebe:

```json
{
  "temperatura": 27.5,
  "umidade": 62.0,
  "aguaPct": 45,
  "luz": 1830
}
```

---

## Última leitura

```http
GET /api/estufa/leitura/latest
```

Retorna a leitura mais recente registrada.

---

## Histórico de leituras

```http
GET /api/estufa/leituras
```

Também pode receber um limite:

```http
GET /api/estufa/leituras?limite=100
```

---

## Estatísticas

```http
GET /api/estufa/stats
```

Disponibiliza estatísticas das leituras armazenadas.

---

## Alertas

```http
GET /api/estufa/alertas
```

Retorna os alertas registrados pelo sistema.

---

## Health Check

```http
GET /api/healthz
```

Utilizado para verificar o funcionamento da API.

---

# 🗄️ Banco de dados

O sistema utiliza **PostgreSQL** para armazenamento das informações.

O acesso ao banco é realizado utilizando **Drizzle ORM**.

## Leituras

A tabela de leituras armazena as informações enviadas pela ESP32.

Principais dados:

```text
id
temperatura
umidade
aguaPct
luz
criadoEm
```

## Alertas

A tabela de alertas armazena situações que ultrapassam os limites definidos pelo sistema.

Principais dados:

```text
id
tipo
valor
limite
criadoEm
```

Tipos de alerta utilizados:

```text
TEMP_ALTA
AGUA_BAIXA
```

---

# 💻 Tecnologias

## ESP32

* C++
* Arduino
* ESP32-S3
* Wi-Fi
* HTTP/HTTPS
* JSON

### Bibliotecas

```text
Wire
LiquidCrystal_I2C
DHT
WiFi
HTTPClient
WiFiClientSecure
```

---

## Backend

* Node.js
* TypeScript
* Express
* Drizzle ORM
* PostgreSQL
* Zod
* Pino
* CORS

---

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* TanStack React Query
* Recharts
* Wouter
* Lucide React
* Framer Motion
* date-fns

---

# 📁 Estrutura do projeto

```text
greenhouse-monitor/
│
├── estufa_wifi/
│   └── estufa_wifi.ino
│
├── artifacts/
│   │
│   ├── estufa-dashboard/
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css
│   │       │
│   │       ├── pages/
│   │       │   ├── dashboard.tsx
│   │       │   ├── historico.tsx
│   │       │   └── alertas.tsx
│   │       │
│   │       ├── components/
│   │       │   ├── layout.tsx
│   │       │   └── ui/
│   │       │
│   │       └── lib/
│   │           └── utils.ts
│   │
│   └── api-server/
│       └── src/
│           ├── index.ts
│           ├── app.ts
│           │
│           ├── routes/
│           │   ├── index.ts
│           │   ├── estufa.ts
│           │   └── health.ts
│           │
│           └── lib/
│
├── lib/
│   ├── db/
│   │   └── src/
│   │       └── schema/
│   │           ├── index.ts
│   │           └── estufa.ts
│   │
│   └── api-spec/
│       └── openapi.yaml
│
└── README.md
```

---

# 🚀 Executando a ESP32

## 1. Abra o firmware

O código da ESP32 está localizado em:

```text
estufa_wifi/estufa_wifi.ino
```

## 2. Configure a rede Wi-Fi

No código:

```cpp
const char* ssid = "SUA_REDE";
const char* password = "SUA_SENHA";
```

## 3. Configure a API

```cpp
const char* serverUrl =
    "https://greenhouse-monitor.replit.app/api/estufa/leitura";
```

## 4. Instale as bibliotecas

Na Arduino IDE, instale:

* DHT sensor library;
* LiquidCrystal I2C;
* ArduinoJson.

As bibliotecas de Wi-Fi e HTTP são fornecidas pelo ambiente ESP32.

## 5. Selecione a placa

Utilize a configuração correspondente à:

```text
ESP32-S3
```

Depois conecte a placa ao computador e faça o upload do firmware.

---

# 🔐 Comunicação HTTPS

A ESP32 utiliza `WiFiClientSecure` para realizar a comunicação HTTPS com a API.

No firmware atual é utilizado:

```cpp
client.setInsecure();
```

Essa configuração desativa a validação do certificado TLS e está presente no código utilizado pelo projeto.

---

# 🔄 Fluxo de funcionamento

O funcionamento completo pode ser resumido da seguinte forma:

```text
1. ESP32 inicia
       ↓
2. LCD é inicializado
       ↓
3. Sensores são inicializados
       ↓
4. ESP32 conecta ao Wi-Fi
       ↓
5. Sensores são lidos
       ↓
6. Regras de automação são executadas
       ↓
7. LCD é atualizado
       ↓
8. Dados são exibidos no Serial Monitor
       ↓
9. JSON é enviado para a API
       ↓
10. API recebe os dados
       ↓
11. Dados são armazenados
       ↓
12. Dashboard consulta os dados
       ↓
13. Processo é repetido após 2 segundos
```

---

# 🧪 Simulação

O projeto pode ser utilizado em ambiente de simulação para testar o funcionamento da ESP32 e dos componentes.

A simulação permite verificar:

* Leitura dos sensores;
* Funcionamento do LCD;
* Acionamento do LED;
* Acionamento do buzzer;
* Regras de automação;
* Comunicação com a API.

---

# 📌 Resumo do sistema

```text
Sensores
   │
   ▼
ESP32-S3
   │
   ├──► Controle da bomba
   │
   ├──► Controle do buzzer
   │
   ├──► LCD
   │
   └──► Wi-Fi
          │
          ▼
        API
          │
          ▼
      PostgreSQL
          │
          ▼
      Dashboard
```

A **ESP32-S3** concentra a leitura dos sensores e as decisões de automação, enquanto a API, o banco de dados e o dashboard são responsáveis pelo recebimento, armazenamento e visualização das informações da estufa.
