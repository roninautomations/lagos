# 🏖️ Casa de Lagos

Calendário de reservas partilhado para uma casa de férias de família,
co-propriedade de todos em partes iguais — **sem anfitrião, sem aprovações,
sem login**. Interface em Português europeu.

Cada pessoa escolhe o seu perfil (estilo Netflix), reserva datas e vê o
calendário do mês com as reservas de cada família em bandas de cor.

## Stack

- **HTML + CSS + JavaScript puro** — sem framework, sem passo de _build_.
- **[Supabase](https://supabase.com)** (plano gratuito) — Postgres para as
  reservas. Carregado via CDN (`@supabase/supabase-js@2`) e chamado
  diretamente do browser com a chave _anon_.
- **[Render](https://render.com) Static Site** — deploy direto do GitHub,
  sem comando de _build_.

## Estrutura

```
index.html              Estrutura da app
styles.css              Estilos (creme + azul-marinho, responsivo)
app.js                  Lógica (calendário, reservas, perfis)
config.js               URL + chave anon do Supabase, textos e lista de perfis
supabase/migration.sql  Tabela de reservas e políticas RLS
```

---

## 1. Configurar o Supabase

1. Cria uma conta em [supabase.com](https://supabase.com) e um novo projeto
   (plano gratuito chega bem).
2. No painel do projeto, abre **SQL Editor** → **New query**, cola todo o
   conteúdo de [`supabase/migration.sql`](supabase/migration.sql) e clica em
   **Run**. Isto cria a tabela `bookings` e as políticas RLS de acesso
   público.
3. Vai a **Project Settings → API** e copia:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - a chave **anon / public**

> ℹ️ **Sobre segurança:** a chave _anon_ é **pública por design** — pode
> ficar visível no browser e no repositório. A proteção vem das políticas
> **RLS**. Como esta app é para uma família de confiança sem login, o acesso
> é intencionalmente aberto (qualquer pessoa com o link pode ler/escrever).
> **Nunca** coloques aqui a chave **`service_role`**.

## 2. Preencher o `config.js`

Abre [`config.js`](config.js) e substitui os valores:

```js
const SUPABASE_URL = "https://xxxx.supabase.co";   // o teu Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOi...";          // a tua chave anon

// Textos do cabeçalho
const HOUSE_NAME = "Casa de Lagos";
const HOUSE_SUBTITLE = "A nossa casa, da nossa família.";
const HOUSE_TAGLINE = "Casa dos Avós";

// Banner (opcional): URL de foto pública ou ficheiro local; "" usa o degradê.
const HERO_IMAGE_URL = "";
```

## 3. Editar a lista de perfis

A lista de perfis está no array `FAMILY_MEMBERS` em `config.js`. Podem ser
**famílias** ou **pessoas** — adiciona, remove ou reordena à vontade (a app
foi pensada para cerca de 10). Cada nome recebe automaticamente uma cor
pastel e um avatar com as iniciais.

```js
const FAMILY_MEMBERS = [
  "Família Sousa",
  "Família Almeida",
  "Família Costa",
  // ... até ~10
];
```

As reservas antigas de um perfil removido continuam a aparecer no calendário.

## 4. Testar localmente

Como não há _build_, basta servir a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000    # ou:  npx serve .
```

Abre <http://localhost:8000>.

## 5. Deploy no Render

1. Faz _push_ deste repositório para o GitHub.
2. Em [render.com](https://render.com): **New → Static Site** e liga o
   repositório.
3. Configuração:
   - **Build Command:** _(deixar vazio)_
   - **Publish Directory:** `.`
4. **Create Static Site**. O Render publica um URL — partilha-o com a família.

A cada _push_ para o branch principal, o Render volta a publicar
automaticamente.

---

## Como se usa

- **Escolher perfil** — no primeiro ecrã, toca no teu nome. Fica guardado no
  `localStorage`; usa o menu (☰) → **"Trocar de perfil"** para mudar.
- **Calendário** — vista mensal com as reservas em bandas de cor por perfil.
  Toca no nome do mês para saltar para outro mês/ano, usa `‹` / `›` ou desliza
  no telemóvel. O dia de hoje aparece com um círculo.
- **Nova reserva** — botão **Fazer pedido de reserva**. O perfil já é o ativo;
  escolhe datas e nº de hóspedes. Se houver sobreposição, aparece um aviso mas
  podes guardar na mesma (bloqueio suave).
- **Ver / editar / cancelar** — toca num dia reservado para ver os detalhes;
  qualquer reserva pode ser editada ou cancelada por qualquer pessoa, com
  confirmação antes de apagar.

## Não-objetivos

Sem login, sem fluxo de aprovação, sem pagamentos, sem agrupamento formal por
famílias (cada perfil é independente).
