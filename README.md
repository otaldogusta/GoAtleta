# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Web patch (yoga-layout)

O `yoga-layout@3.2.1` contem `import.meta.url` no bundle ESM e o Metro nao transpila `node_modules`, causando tela branca no Web com o erro:

`Cannot use import.meta outside a module`

Para evitar isso, mantemos um patch com `patch-package` que remove esse trecho do arquivo:

- Patch: `patches/yoga-layout+3.2.1.patch`
- Aplicacao automatica: `npm install` (via `postinstall`)
- Versao fixada: `yoga-layout: 3.2.1`

Atualizacao:

```bash
npx patch-package yoga-layout
```

### Checklist de validacao

- [ ] `rm -rf node_modules && npm install`
- [ ] `npm run web` (dev)
- [ ] build web em modo production (se existir)
- [ ] CI usando `npm ci`

### Problemas na instalacao (postinstall)

Se o `postinstall` falhar, rode:

```bash
npm install
```

Se o erro persistir, confira se o patch existe em `patches/yoga-layout+3.2.1.patch`
e regenere com:

```bash
npx patch-package yoga-layout
```

## UI pattern: dropdown ancorado (lista fixa + scroll interno)

Padrao usado para selects com lista fixa e scroll interno, igual na tela de
periodizacao e no cadastro de turmas.

Regras do padrao:
- Ao clicar, abre lista abaixo do campo (ancorada no trigger).
- So um dropdown aberto por vez.
- Scroll acontece dentro da lista, nao na tela.
- Ao rolar a tela, a lista acompanha o campo (recalcula layout).

Onde usar como referencia:
- `src/ui/AnchoredDropdown.tsx`
- `app/periodization/index.tsx`
- `app/classes/index.tsx`

Checklist rapido ao aplicar em outra tela:
- Definir `triggerRef` + `triggerLayout` para cada campo.
- Usar `toggleNewPicker` (ou equivalente) para fechar outras listas.
- No `ScrollView`, chamar `syncPickerLayouts` no `onScroll`.

## Supabase migrations (scouting)

Para habilitar o modulo de scouting no Supabase, crie a tabela:

- `supabase/migrations/20260106_create_scouting_logs.sql`

Rodar no SQL Editor do Supabase e depois atualizar o schema:

```sql
select pg_notify('pgrst', 'reload schema');
```

## Importacao de planejamento (CSV)

O importador resolve a turma pelo `title` e pela `date` no CSV.

Regras:
- `date` deve estar em `YYYY-MM-DD`.
- `title` precisa conter tokens no formato: `<UNIDADE> | <HORARIO> | <FAIXA> | ...`
- `HORARIO` deve ser `HH:MM-HH:MM` (com zero a esquerda).
- `FAIXA` aceita `8-11` e sera normalizada para `08-11`.

Exemplo:
```
Rede Esperanca | 14:00-15:00 | 08-11 | Semana 01 - Diagnostica
```

Exemplo de CSV (1 linha):
```
date,title,warmup_time,warmup,main_time,main,cooldown_time,cooldown,objective_general,objective_specific,observations
2026-01-06,"Rede Esperanca | 14:00-15:00 | 08-11 | Semana 01 - Diagnostica","10 min","Pega-pega","45 min","Toque para alvo | Mini jogo 1x1","5 min","Roda de conversa","Diagnostico do mes","Controle de bola e toque",""
```

Se existir ambiguidade (mais de uma turma com mesma unidade + horario + faixa + dia),
o importador retorna erro com a lista de turmas candidatas.

## Pendencias (to-do)

- Home > Agenda do dia: revisar botao "Fazer chamada" para abrir a turma correta do dia/horario, e opcionalmente exibir turma/horario no botao.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
