## Pre requisitos

- **Node.js**
- **Ligolo-ng**

## Intalação

1. **Clone o repositorio**:

   ```bash
   git clone https://github.com/italo-carmo/tunel-manager.git
   cd tunel-manager
   ```

2. **Intale as dependencias**:

   ```bash
   npm install
   ```

## Start

Habilite o arquivo ligolo-ng.yaml do Ligolo Proxy com esses dados:
```
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

```bash
npm run dev
```

Ao entrar na interface web:
```
API URL: http://127.0.0.1:8080
Usuário: ligolo
Senha: password
```
