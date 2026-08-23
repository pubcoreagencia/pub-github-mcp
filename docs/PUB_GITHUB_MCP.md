# PUB GITHUB MCP — Servidor MCP Remoto para Cloudflare Workers

O **PUB GITHUB MCP** é a implementação remota, segura e de produção do Model Context Protocol (MCP) para a infraestrutura da **PUB Core**, hospedado como um Cloudflare Worker.

Ele permite que agentes inteligentes (AG, Hermes, OpenClaw, PUB DEV LOOP, etc.) interajam com a API do GitHub de forma distribuída e independente de máquinas locais ou containers Docker.

---

## 1. Arquitetura

```
Agent / AG / Clients (Remote / Local)
             │
             │ HTTPS / JSON-RPC 2.0 (Bearer Auth)
             ▼
    Cloudflare Worker
    [ PUB GITHUB MCP ]
             │
             │ REST API (Strict Org Scope: pubcoreagencia/*)
             ▼
      GitHub API
```

---

## 2. Endpoints e Rotas

| Rota | Método | Descrição | Autenticação |
|---|---|---|---|
| `/health` | `GET` | Verificação de integridade e metadados seguros | Pública |
| `/mcp` | `POST` | Chamadas de ferramentas MCP via JSON-RPC 2.0 | `Authorization: Bearer <MCP_AUTH_TOKEN>` |
| `/mcp` | `GET` | SSE (Server-Sent Events) Stream | `Authorization: Bearer <MCP_AUTH_TOKEN>` ou `?token=` |

---

## 3. Autenticação e Segurança

### Autenticação do Cliente
Toda requisição para `/mcp` deve conter o header:
```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```
Caso contrário, a requisição é rejeitada com `401 Unauthorized`.

### Restrição de Organização (Allowlist)
- Todas as ferramentas operam exclusivamente sobre repositórios da organização **`pubcoreagencia/*`**.
- Qualquer tentativa de acessar ou modificar repositórios fora dessa organização resulta em erro imediato `403 Forbidden` sem executar chamadas à API do GitHub.

### Proteção de Escrita e Operações Destrutivas
- **Proibido**: Deletar repositórios, alterar configurações da organização, gerenciar membros, manipular GitHub secrets ou deletar branches protegidas (`main`, `master`).
- **Validações**: Toda escrita exige validação rigorosa de parâmetros via Zod schemas, sanitize de paths e verificação de integridade de SHAs.

---

## 4. Ferramentas MCP Implementadas (20 Tools)

| # | Ferramenta | Descrição |
|---|---|---|
| 1 | `list_repositories` | Lista repositórios da organização `pubcoreagencia` |
| 2 | `get_repository` | Obtém detalhes de um repositório permitido |
| 3 | `get_file` | Lê conteúdo decodificado (UTF-8) e metadados de um arquivo |
| 4 | `list_directory` | Lista arquivos e diretórios em um path |
| 5 | `search_code` | Pesquisa código nos repositórios da organização |
| 6 | `get_branch` | Obtém dados de uma branch específica |
| 7 | `list_branches` | Lista branches de um repositório |
| 8 | `get_commits` | Lista histórico de commits com paginação e filtro de path |
| 9 | `get_commit` | Obtém detalhes de um commit por SHA ou ref |
| 10 | `get_issue` | Obtém detalhes de uma issue |
| 11 | `list_issues` | Lista issues com filtros de estado (`open`, `closed`) e labels |
| 12 | `create_issue` | Cria uma nova issue |
| 13 | `update_issue` | Atualiza título, corpo, labels ou estado de uma issue |
| 14 | `get_pull_request` | Obtém dados de um Pull Request |
| 15 | `list_pull_requests` | Lista PRs com filtros |
| 16 | `create_pull_request` | Abre um novo PR |
| 17 | `get_pull_request_diff` | Obtém o diff unificado de um PR |
| 18 | `create_branch` | Cria uma nova branch a partir de uma base |
| 19 | `create_or_update_file` | Cria ou atualiza um arquivo com commit |
| 20 | `create_commit` | Cria commits diretamente via Git Data API |

---

## 5. Secrets e Variáveis de Ambiente

### Cloudflare Secrets
- `GITHUB_TOKEN`: Personal Access Token do GitHub com escopo `repo`, `read:org`, `workflow`.
- `MCP_AUTH_TOKEN`: Token Bearer secreto gerado para autenticar clientes no Worker.

Configuração via Wrangler CLI:
```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put MCP_AUTH_TOKEN
```

---

## 6. Coexistência e Fallback com MCP Local (Docker)

O servidor local atual (`ghcr.io/github/github-mcp-server` via Docker / STDIO) foi mantido intacto.

### Comparativo

| Característica | MCP Local (Docker) | PUB GITHUB MCP (Cloudflare Worker) |
|---|---|---|
| **Hospedagem** | Docker local / stdio | Nuvem (Cloudflare Edge Workers) |
| **Disponibilidade** | Apenas quando PC local e Docker estão ativos | 24/7 de qualquer lugar |
| **Escopo** | Global / Depende do token do Docker | Estrito a `pubcoreagencia/*` |
| **Auditoria** | Logs locais do Docker | Structured Observability no Cloudflare |
| **Uso Principal** | Fallback para desenvolvimento offline | Produção e agentes distribuídos |

### Procedimento de Fallback
Caso o Worker remoto fique inacessível ou ocorra falha de rede externa, os agentes podem alternar a configuração do cliente para o MCP local stdio sem qualquer alteração no código do projeto.

---

## 7. Como Conectar os Clientes MCP

### Exemplo de Configuração para Antigravity / Cursor / Claude Desktop

```json
{
  "mcpServers": {
    "pub-github-remote": {
      "url": "https://pub-github-mcp.contato-pubcore.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>"
      }
    }
  }
}
```
