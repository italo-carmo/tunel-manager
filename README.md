# Tunel Manager

Interface web para operar o [Ligolo-ng](https://github.com/nicocha30/ligolo-ng) com mais conforto durante laboratorios, operacoes internas e testes de tunelamento. O frontend conversa com a API HTTP do Ligolo Proxy, lista agentes conectados, cria interfaces e rotas, inicia/para tuneis, cria listeners e desenha a topologia em tempo real.

> Este guia usa os nomes atuais do Ligolo-ng: **proxy** para o servidor e **agent** para o cliente que se conecta ao proxy. Em conversas antigas do projeto, "server/client" podem aparecer com o mesmo sentido.

## O que o sistema faz

- Login na API do Ligolo Proxy.
- Listagem de agentes conectados, com status de tunelamento e redes detectadas.
- Criacao e remocao de interfaces Ligolo.
- Criacao e remocao de rotas em interfaces.
- Start/stop de tunelamento por agente.
- Autoroute: cria rotas com base nas redes anunciadas pelo agente.
- Criacao e remocao de listeners TCP/UDP.
- Tela de topologia com caixas arrastaveis, linhas de tuneis/listeners e labels de portas.

## Arquitetura

```text
Navegador
  |
  | http://127.0.0.1:5173
  v
Tunel Manager (React/Vite)
  |
  | API HTTP: /api/auth, /api/v1/agents, /api/v1/interfaces,
  |           /api/v1/routes, /api/v1/listeners, /api/v1/tunnel/:id
  v
Ligolo Proxy
  |
  | porta de controle para agents, por exemplo 11601/tcp
  v
Ligolo Agents
```

O frontend nao cria interfaces diretamente no sistema operacional. Ele envia comandos para o Ligolo Proxy, e o proxy e quem precisa ter permissao para criar interfaces TUN e manipular rotas.

## Requisitos

- Node.js 20 ou superior.
- npm.
- Ligolo-ng com API/web habilitada no proxy.
- Navegador moderno.
- Para teste real de tunelamento: Linux com permissao de TUN/rotas, ou container Docker privilegiado.

Observacao importante sobre macOS: o frontend roda normalmente no macOS, e o proxy/agent tambem podem conectar e responder pela API. Porem, iniciar interfaces TUN pelo Ligolo no macOS pode falhar com erro parecido com `unable to open tun interface ... operation not permitted`. Para teste ponta a ponta de interface ativa e tunelamento, prefira Linux ou Docker privilegiado.

## Instalacao do Tunel Manager

Clone o projeto e instale as dependencias:

```bash
git clone https://github.com/italo-carmo/tunel-manager.git
cd tunel-manager
npm install
```

Opcionalmente, crie um `.env.local` para deixar a URL da API preenchida na tela de login:

```bash
VITE_DEFAULT_API_URL=http://127.0.0.1:18080
VITE_ENABLE_ERROR_DEBUG=true
```

Inicie o frontend:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Acesse:

```text
http://127.0.0.1:5173
```

Para build de producao:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Instalacao do Ligolo-ng

Baixe o Ligolo-ng para o seu sistema operacional e arquitetura na pagina de releases:

```text
https://github.com/nicocha30/ligolo-ng/releases
```

Voce precisara dos dois binarios:

- `proxy`: roda no lado servidor, recebe agents e executa as operacoes de tunelamento.
- `agent`: roda no host que vai se conectar ao proxy.

Em um laboratorio local, uma estrutura simples fica assim:

```text
ligolo/
  proxy
  agent
  ligolo-ng.yaml
```

De permissao de execucao aos binarios:

```bash
chmod +x ./proxy ./agent
```

## Configuracao do Ligolo Proxy

Crie ou edite o `ligolo-ng.yaml` do proxy. O ponto principal para o Tunel Manager e habilitar a API/web e liberar CORS para o Vite em `127.0.0.1:5173`.

Exemplo de configuracao local:

```yaml
web:
  enabled: true
  enableui: true
  listen: 127.0.0.1:18080
  behindreverseproxy: false
  corsallowedorigin:
    - http://127.0.0.1:5173
    - http://localhost:5173
  trustedproxies:
    - 127.0.0.1
  debug: true
  logfile: ui.log
  secret: 8c77c652304654bc4be3c78ce8a76b9df99d185d978055f4fa2421e05e8ad164
  tls:
    enabled: false
    selfcert: false
    certfile: ""
    keyfile: ""
    autocert: false
    alloweddomains: []
    selfcertdomain: ligolo
  users:
    ligolo: $argon2id$v=19$m=32768,t=3,p=4$H/V+uCAZhdP9srEdvWtk7w$0qo3fCMUVWLdRnupiYd+uYZRTmvSFqI19tDN+FI7Mzc
```

Nesse exemplo:

- API URL: `http://127.0.0.1:18080`
- Usuario: `ligolo`
- Senha: `password`

Troque `secret`, usuario e senha antes de usar fora de um laboratorio local. Se mudar a porta do frontend, adicione a nova origem em `corsallowedorigin`.

## Subindo proxy e agent

Em Linux, rode o proxy com privilegios suficientes para criar TUN e rotas:

```bash
sudo ./proxy \
  -selfcert \
  -laddr 0.0.0.0:11601 \
  -api-laddr 127.0.0.1:18080 \
  -config ligolo-ng.yaml \
  -v
```

O que cada endereco significa:

- `-laddr 0.0.0.0:11601`: porta onde os agents se conectam.
- `-api-laddr 127.0.0.1:18080`: API usada pelo Tunel Manager.

Em outro terminal ou host, conecte um agent:

```bash
./agent -connect 127.0.0.1:11601 -ignore-cert -v
```

Se o agent estiver em outra maquina ou container, troque `127.0.0.1` pelo IP ou hostname do proxy.

## Primeiro acesso

1. Inicie o Ligolo Proxy.
2. Conecte pelo menos um Ligolo Agent.
3. Inicie o Tunel Manager com `npm run dev -- --host 127.0.0.1 --port 5173`.
4. Abra `http://127.0.0.1:5173`.
5. Faca login com:

```text
API URL: http://127.0.0.1:18080
Usuario: ligolo
Senha: password
```

Depois do login, a sessao fica salva no `localStorage`. Se a API mudar de porta ou a sessao expirar, faca logout e entre novamente com a nova URL.

## Fluxo recomendado de uso

1. Entre na tela **Agentes** e confirme que o agent aparece conectado.
2. Expanda o agent para ver as interfaces/redes detectadas.
3. Crie uma interface Ligolo ou use a opcao **Tunelar -> Nova interface**.
4. Inicie o tunelamento do agent.
5. Adicione rotas pela tela **Interfaces**, pelo **Autoroute** em **Agentes**, ou pelo botao **+ Rota** na **Topologia**.
6. Crie listeners quando precisar expor uma porta do lado do agent para um destino acessivel pelo proxy.
7. Abra **Topologia** para visualizar os tuneis/listeners e organizar as caixas arrastando com o mouse.

## Tela Login

A tela de login pede:

- API URL do Ligolo Proxy, por exemplo `http://127.0.0.1:18080`.
- Usuario configurado no `ligolo-ng.yaml`.
- Senha do usuario.

Ao autenticar, o frontend valida a API com `/api/v1/ping` e usa o token retornado por `/api/auth` nas chamadas seguintes.

## Tela Agentes

A tela **Agentes** mostra cada agent conectado com:

- ID.
- Nome do agent.
- Endereco remoto e `SessionID`.
- Interface Ligolo vinculada.
- Status `Tunneling` ou `Stopped`.

Acoes disponiveis:

- **Autoroute**: cria interface/rotas a partir das redes detectadas no agent e pode iniciar o tunel.
- **Tunelar**: inicia o tunel usando uma nova interface ou uma interface pendente existente.
- **Stop tunneling**: para o tunel daquele agent.
- **Expandir**: mostra interfaces e enderecos anunciados pelo agent.

O menu de tunelamento lista apenas interfaces uteis para iniciar tunel. Interfaces fisicas ou ja ativas no sistema nao aparecem como opcao de bind.

## Tela Interfaces

A tela **Interfaces** mostra:

- Nome da interface.
- Estado `Active` ou `Pending`.
- Rotas cadastradas.
- Acoes para adicionar rota ou remover interface.

Estados:

- `Active`: a interface ja existe no sistema onde o proxy roda.
- `Pending`: a interface esta cadastrada para ser criada/ativada quando o tunel iniciar.

Para adicionar rota manualmente, use o formato CIDR:

```text
172.30.10.0/24
10.10.0.0/16
```

No macOS, o sistema sugere nomes `utunN`. Em Linux, ele gera nomes curtos aleatorios dentro do limite de 15 caracteres usado por interfaces de rede.

## Tela Listeners

A tela **Listeners** permite criar, listar, filtrar, ordenar e remover listeners.

Filtros disponiveis:

- Por agent.
- Por porta, buscando tanto no endereco de escuta quanto no destino.
- Ordenacao por ID, agent, porta de escuta ou porta de redirecionamento.

Ao criar um listener:

1. Escolha o agent.
2. Escolha um IP sugerido do agent ou use `0.0.0.0`.
3. Preencha o endereco de escuta, por exemplo `0.0.0.0:8081`.
4. Preencha o destino, por exemplo `127.0.0.1:8080`.
5. Escolha o protocolo `TCP` ou `UDP`.
6. Clique em **Add listener**.

O modal de listener pode ser arrastado pelo cabecalho, util quando voce esta comparando dados com a topologia ao fundo.

## Tela Topologia

A tela **Topologia** junta o gerenciamento de listeners com um desenho visual da rede.

Ela mostra:

- Uma tabela de listeners no topo.
- Botoes **Resetar Layout**, **Nova Interface** e **Novo Listener**.
- Caixas para proxy/destinos e agents.
- Linhas representando listeners/tuneis.
- Labels de porta nas extremidades das linhas.
- Painel de cada agent com status, interface atual, **Tunelar**, **Parar**, **+ Listener** e **+ Rota**.

Como organizar:

- Arraste as caixas livremente para reposicionar a topologia.
- O desenho salva as posicoes no navegador.
- Use **Resetar Layout** para voltar ao posicionamento calculado automaticamente.
- Quando ha mais de um listener entre os mesmos lados, as linhas sao desenhadas em paralelo para evitar sobreposicao.

Como interpretar:

- A origem do listener e o endereco configurado em `Listener Address`, associado ao agent quando possivel.
- O destino e `Redirect Address`.
- A porta aparece em pequenos labels perto das conexoes.
- Um agent sem listener ainda pode aparecer como caixa se estiver conectado.

## Laboratorio com Docker/Linux

Use Docker quando quiser testar criacao real de TUN e rotas sem depender do macOS. O container do proxy precisa ser privilegiado e ter `/dev/net/tun`.

Se voce estiver no macOS, baixe os binarios **Linux** do Ligolo-ng para usar dentro dos containers. Os binarios macOS servem para rodar direto no host, mas nao executam dentro do Alpine/Linux.

No macOS, com Homebrew:

```bash
brew install docker colima
colima start --vm-type vz --arch aarch64 --cpu 2 --memory 2 --disk 20
```

Crie uma rede de controle:

```bash
docker network create ligolo-control
```

Suba um container para o proxy, montando a pasta onde estao `proxy`, `agent` e `ligolo-ng.yaml`:

```bash
docker run --rm -it \
  --name ligolo-proxy \
  --network ligolo-control \
  --privileged \
  --cap-add NET_ADMIN \
  --device /dev/net/tun \
  -p 11601:11601 \
  -p 18080:18080 \
  -v "$PWD/ligolo:/ligolo" \
  -w /ligolo \
  alpine:3.20 \
  ./proxy -selfcert -laddr 0.0.0.0:11601 -api-laddr 0.0.0.0:18080 -config ligolo-ng.yaml -v
```

Em outro terminal, suba um agent em outro container:

```bash
docker run --rm -it \
  --name ligolo-agent-a \
  --network ligolo-control \
  -v "$PWD/ligolo:/ligolo" \
  -w /ligolo \
  alpine:3.20 \
  ./agent -connect ligolo-proxy:11601 -ignore-cert -v
```

Depois, no Tunel Manager:

1. Login em `http://127.0.0.1:18080`.
2. Abra **Agentes** e confirme o agent conectado.
3. Clique em **Tunelar -> Nova interface**.
4. Verifique em **Interfaces** se a interface ficou `Active`.
5. Crie um listener e confira a linha na **Topologia**.

Para testar varios agents, suba mais containers `ligolo-agent-b`, `ligolo-agent-c` na mesma rede `ligolo-control`. Se quiser redes distintas por agent, crie redes Docker adicionais com subnets diferentes e conecte cada agent a uma delas.

Limpeza do laboratorio:

```bash
docker rm -f ligolo-proxy ligolo-agent-a ligolo-agent-b ligolo-agent-c
docker network rm ligolo-control
```

## Troubleshooting

### O login falha

- Confirme se a API responde:

```bash
curl http://127.0.0.1:18080/api/v1/ping
```

Esse endpoint pode retornar `401` quando chamado sem token; ainda assim, isso confirma que existe uma API respondendo nessa porta. Para testar autenticacao:

```bash
curl -s \
  -X POST http://127.0.0.1:18080/api/auth \
  -H 'Content-Type: application/json' \
  -d '{"username":"ligolo","password":"password"}'
```

- Confira se `corsallowedorigin` inclui `http://127.0.0.1:5173`.
- Confira usuario e senha no `ligolo-ng.yaml`.
- Se voce mudou a API URL, faca logout e entre novamente.

### A tela nao mostra agents

- Confirme se o agent esta conectado ao proxy.
- Veja os logs do proxy: ele deve registrar a conexao do agent.
- Confira se o frontend esta logado na mesma API onde o proxy esta rodando.

### Clicar em Tunelar falha

- No Linux/container, confirme se o proxy tem permissao de TUN:

```bash
ls -l /dev/net/tun
```

- Em Docker, use `--privileged`, `--cap-add NET_ADMIN` e `--device /dev/net/tun`.
- No macOS, o erro `operation not permitted` ao abrir `utunN` e esperado em alguns ambientes. Rode o proxy em Linux para validar o fluxo completo.

### A interface fica Pending

`Pending` significa que a interface ainda nao foi materializada pelo proxy no sistema operacional. Normalmente ela passa para `Active` quando um tunel e iniciado usando aquela interface.

### O tunel nao aparece desenhado

- Confirme se existe listener criado em **Listeners**.
- Confira se o listener esta `Online` na API do Ligolo.
- Use **Resetar Layout** na Topologia se as caixas foram arrastadas para fora da area visivel.
- Verifique se ha filtros ativos na tabela de listeners.

### Porta do listener nao responde

- Confirme se o servico de destino existe no endereco de `Redirect Address`.
- Confirme se o protocolo esta correto (`TCP` ou `UDP`).
- Teste de dentro do host/container do agent para o endereco de escuta.
- Veja logs do proxy e do agent.

## Validacao local do projeto

Comandos uteis antes de abrir PR ou depois de editar codigo:

```bash
npm run build
npx eslint -c eslint.config.js './src/**/*.{ts,tsx}'
git diff --check
```

Observacao: o script `npm run lint` do projeto executa ESLint com `--fix`, entao ele pode modificar arquivos automaticamente.

## Seguranca

Este projeto foi pensado para uso assistido em laboratorio ou operacoes controladas. Antes de expor a API do Ligolo ou o Tunel Manager em rede compartilhada:

- Troque usuario, senha e `secret`.
- Use TLS quando a API sair de `localhost`.
- Restrinja CORS as origens necessarias.
- Proteja a porta de controle dos agents.
- Evite publicar o proxy/API diretamente na internet.

## Estado validado

O fluxo foi testado com frontend Vite, Ligolo-ng v0.8.3, proxy/agent reais e laboratorio Docker/Linux com multiplos agents. Foram validados:

- Login na API do proxy.
- Listagem de agentes.
- Criacao de interfaces.
- Start de tunel por agent.
- Interfaces ativas em Linux/container privilegiado.
- Criacao de listeners.
- Encaminhamento real por listeners.
- Topologia com multiplos agents, multiplas linhas e labels de portas.
- Arrastar e reorganizar caixas da topologia.
