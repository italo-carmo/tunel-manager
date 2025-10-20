# Tunel Manager

## 🇧🇷 Português

### Visão Geral
O Tunel Manager fornece uma interface web para facilitar a administração do [Ligolo-ng](https://github.com/nicocha30/ligolo-ng) durante operações de tunelamento. Este guia apresenta todas as etapas necessárias, desde a instalação até o uso diário, incluindo dúvidas frequentes.

### Pré-requisitos
- **Node.js** (versão compatível com projetos Vite/React)
- **Ligolo-ng** instalado e configurado no mesmo host

### Instalação
1. **Clonar o repositório**
   ```bash
   git clone https://github.com/italo-carmo/tunel-manager.git
   cd tunel-manager
   ```
2. **Instalar dependências**
   ```bash
   npm install
   ```

### Configuração do Ligolo Proxy
Edite o arquivo `ligolo-ng.yaml` do Ligolo Proxy e habilite a interface web com as opções abaixo:
```yaml
web:
    behindreverseproxy: false
    corsallowedorigin:
        - http://127.0.0.1:8080
        - http://127.0.0.1:5173
        - http://localhost:5173
    debug: true
    enabled: true
    enableui: true
    listen: 127.0.0.1:8080
    logfile: ui.log
    secret: 8c77c652304654bc4be3c78ce8a76b9df99d185d978055f4fa2421e05e8ad164
    tls:
        alloweddomains: []
        autocert: false
        certfile: ""
        enabled: false
        keyfile: ""
        selfcert: false
        selfcertdomain: ligolo
    trustedproxies:
        - 127.0.0.1
    users:
        ligolo: $argon2id$v=19$m=32768,t=3,p=4$H/V+uCAZhdP9srEdvWtk7w$0qo3fCMUVWLdRnupiYd+uYZRTmvSFqI19tDN+FI7Mzc
```
Ajuste portas, credenciais ou segredos conforme necessário para o seu ambiente.

### Execução
1. **Iniciar o Ligolo Proxy (obrigatório antes do Tunel Manager)**
   ```bash
   sudo ./ligolo-proxy -config ligolo-ng.yaml
   ```
   > Usar `sudo` garante permissão para criar interfaces, rotas e outras operações de rede.

2. **Iniciar o Tunel Manager**
   ```bash
   npm run dev
   ```
   O Vite iniciará o aplicativo na porta padrão `5173` (ou a próxima porta disponível).

### Acesso à interface web
Depois que o proxy e o Tunel Manager estiverem em execução, acesse o navegador e preencha:
```
API URL: http://127.0.0.1:8080
Usuário: ligolo
Senha: password
```
(Altere os dados conforme a configuração do seu proxy.)

### Dúvidas frequentes
- **Preciso iniciar o proxy antes do Tunel Manager?**  Sim. O Tunel Manager depende da API do Ligolo Proxy para carregar dados e enviar comandos.
- **Por que executar o proxy com sudo?**  O Ligolo-ng cria interfaces de rede virtuais e manipula rotas; essas ações exigem privilégios elevados em sistemas Unix-like.
- **Posso alterar usuário e senha?**  Sim, basta ajustar a seção `users` do `ligolo-ng.yaml`.
- **O Tunel Manager pode rodar em produção?**  Este projeto é focado em uso assistido durante operações de tunelamento; revise os controles de acesso e faça hardening antes de expor em ambientes críticos.

---

## 🇺🇸 English

### Overview
Tunel Manager provides a web interface to simplify [Ligolo-ng](https://github.com/nicocha30/ligolo-ng) tunnel operations. This guide walks you through every step from installation to daily usage, including a FAQ section.

### Prerequisites
- **Node.js** (version compatible with Vite/React projects)
- **Ligolo-ng** installed and configured on the same host

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/italo-carmo/tunel-manager.git
   cd tunel-manager
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```

### Ligolo Proxy configuration
Edit the Ligolo Proxy `ligolo-ng.yaml` file and enable the web interface with the following options:
```yaml
web:
    behindreverseproxy: false
    corsallowedorigin:
        - http://127.0.0.1:8080
        - http://127.0.0.1:5173
        - http://localhost:5173
    debug: true
    enabled: true
    enableui: true
    listen: 127.0.0.1:8080
    logfile: ui.log
    secret: 8c77c652304654bc4be3c78ce8a76b9df99d185d978055f4fa2421e05e8ad164
    tls:
        alloweddomains: []
        autocert: false
        certfile: ""
        enabled: false
        keyfile: ""
        selfcert: false
        selfcertdomain: ligolo
    trustedproxies:
        - 127.0.0.1
    users:
        ligolo: $argon2id$v=19$m=32768,t=3,p=4$H/V+uCAZhdP9srEdvWtk7w$0qo3fCMUVWLdRnupiYd+uYZRTmvSFqI19tDN+FI7Mzc
```
Adjust ports, credentials, or secrets as required for your environment.

### Running
1. **Start the Ligolo Proxy (must be running before Tunel Manager)**
   ```bash
   sudo ./ligolo-proxy -config ligolo-ng.yaml
   ```
   > Running with `sudo` allows Ligolo-ng to create interfaces, routes, and other network artifacts.

2. **Start Tunel Manager**
   ```bash
   npm run dev
   ```
   Vite will launch the app on port `5173` (or the next available port).

### Web interface access
Once both the proxy and Tunel Manager are running, open your browser and enter:
```
API URL: http://127.0.0.1:8080
User: ligolo
Password: password
```
(Replace with the values configured in your proxy.)

### Frequently asked questions
- **Do I need to start the proxy before the Tunel Manager?**  Yes. Tunel Manager relies on the Ligolo Proxy API to load data and issue commands.
- **Why do I need sudo for the proxy?**  Ligolo-ng creates virtual interfaces and manipulates routes; these operations require elevated privileges on Unix-like systems.
- **Can I change the username and password?**  Yes, update the `users` section in `ligolo-ng.yaml`.
- **Is Tunel Manager production-ready?**  The project targets assisted usage during tunneling operations; audit access controls and harden the setup before exposing it in sensitive environments.
