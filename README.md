# PUB GITHUB MCP

Servidor MCP remoto de produção da **PUB Core**, desenvolvido em TypeScript e hospedado no Cloudflare Workers.

## Funcionalidades

- Compatível com a especificação Model Context Protocol (MCP).
- Suporte a JSON-RPC 2.0 e Server-Sent Events (SSE) stream.
- Restrição estrita de escopo à organização `pubcoreagencia/*`.
- 20 ferramentas implementadas com validação Zod.
- Autenticação Bearer Token.
- Structured Observability e sanitização de dados sensíveis.

## Desenvolvimento

```bash
npm install
npm test
npm run typecheck
npm run dev
```

## Deploy

```bash
npm run deploy
```

Consulte `docs/PUB_GITHUB_MCP.md` para documentação detalhada.
