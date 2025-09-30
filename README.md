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

```bash
npm run dev
```

Habilite o arquivo ligolo-ng.yaml do Ligolo Proxy:

web:
  enabled: true         # liga a API
  enableui: true        # serve a UI
  addr: 127.0.0.1:8080  # onde vai escutar
  corsallowedorigin:
    - http://127.0.0.1:8080

Ao entrar na interface web:

API URL: http://127.0.0.1:8080
Usuário: ligolo
Senha: password
