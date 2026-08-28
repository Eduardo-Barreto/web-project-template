# Decisões do gate de qualidade

Registro de por que o gate deste repo tem a forma que tem. Nenhum agente lê este arquivo durante o `/deliver`; ele existe para quem precisar mudar as regras depois e quiser saber o que já foi tentado.

A base veio do template interno da Group Link One. As três últimas seções registram onde este repo divergiu dele.

## O que mudou em agosto de 2026

A fase 6 do `/deliver` tinha onze subagents LLM. Sete deles checavam coisas que uma AST decide sem ambiguidade: naming, complexidade, docstrings, supressões, type-safety, título de teste, a11y estático. O custo era pago duas vezes, em token e em variância: o mesmo diff podia dar PASS numa rodada e FAIL na outra, porque um reviewer instruído a achar lacunas reporta algumas mesmo quando não existem.

Hoje são dois: `review-plan` na fase 2 e `review-judgment` na fase 6. Tudo o que era regra virou configuração e código.

## Por que cada peça está onde está

**As regras do projeto viraram um JS plugin do oxlint, não ast-grep.** Os JS plugins do oxlint estão em alpha, e isso é um risco real. Ficaram escolhidos porque rodam na mesma invocação que já roda no `doctor`, no hook de `PostToolUse` e no pre-commit, escritos em TypeScript, com a API do ESLint v9. O plano B, se a alpha morder, é o mesmo conjunto de regras em ast-grep (YAML, estável, com `sg test`), e o custo de migração é reescrever `.oxlint-plugins/` mantendo os testes.

**Três substitutos óbvios não existiam.** O oxlint 1.71 não tem `eslint/no-restricted-syntax`, `unicorn/prevent-abbreviations` nem `jsdoc/require-jsdoc`. Elas viraram `no-test-id-query`, `no-vague-identifier` e `require-tsdoc-on-exports` no plugin do projeto. Se alguma delas chegar ao oxlint, a regra própria correspondente pode sair.

**O plugin vitest do oxlint não serve aqui.** Ele só reconhece testes que importam de `vitest`, e este repo roda `bun:test`. Foi por isso que `test-title-no-should` e `require-top-level-describe` viraram regras próprias em vez de `vitest/valid-title` e `vitest/require-top-level-describe`.

**TypeScript 7, e `tsc -b` continua separado do lint.** As 59 regras type-aware do oxlint rodam sobre `oxlint-tsgolint`, que embute typescript-go 7.0.2. Subir o repo para TS 7.0.2 alinhou o compilador do gate com o do build. A doc do oxlint diz que `typeCheck: true` pode substituir um passo separado de `tsc --noEmit`, e isso não foi feito de propósito: com o TS 7 o próprio `tsc` já é Go e roda em 0,3s, então o ganho encolheu, e ligar os dois faria o mesmo erro de tipo ser reportado por dois caminhos.

**`exactOptionalPropertyTypes` ficou de fora.** Ela gera erro em `src/components/ui/**`, que é shadcn vendored e é sobrescrito pelo `bunx shadcn add`. A causa é o ecossistema React não declarar `| undefined` em prop opcional, não dívida deste repo. Ligar significaria que qualquer `shadcn add` futuro quebra o typecheck sem relação com o que a pessoa estava fazendo. As outras três flags (`strict` explícito, `noUncheckedIndexedAccess`, `noImplicitOverride`) estão ligadas.

**Frescor por hash de conteúdo, não por timestamp de commit.** O gate antigo comparava o `mtime` do arquivo de findings contra `git log -1 --format=%ct`, então qualquer commit invalidava os onze reviewers. Isso obrigava uma coreografia documentada em três parágrafos: acumule fixes sem commitar, confirme cada um com o reviewer afetado, commite uma vez só, rode o script de scope de novo. O `scripts/scope-hash.ts` hasheia caminho e conteúdo de cada arquivo no escopo, então commit, amend, rebase e staging não mudam nada, e uma mudança real de código invalida corretamente. Os testes em `scripts/scope-hash.test.ts` são exatamente esses casos.

**O `review-scope.ts` foi deletado, não corrigido.** Ele decidia quais dos onze reviewers se aplicavam ao diff e apagava o diretório de findings quando rodado sem `--dry-run`, um default destrutivo que estava documentado em três lugares diferentes em prosa. Com um reviewer só, não há matriz de aplicabilidade nem diretório para resetar.

**Não há scan de segredos, e isso é uma escolha.** A `gitleaks-action@v2` exige `GITLEAKS_LICENSE` em repo de organização. O binário OSS resolveria isso sem licença, mas entre a licença, o download com checksum, a alternativa em docker e o job de pre-push, a ferramenta custou mais discussão do que entrega num SPA sem backend. Quem olha segredo hoje é o `review-judgment`, e o charter dele diz isso explicitamente, em vez de deixar a impressão de que algum linter cobre. Se um segredo escapar uma vez, a resposta certa é `gitleaks git` pinado num step do CI, não voltar a discutir docker.

**`bun audit` informa, não bloqueia.** Ele consulta o banco de advisories do npm com a lista de pacotes instalados, então não olha uma linha do código deste repo. Na primeira execução real reprovou o CI com seis advisories, todos em árvore transitiva de ferramenta de desenvolvimento: `shadcn` puxa undici, ip-address e js-yaml; `react-doctor` puxa o eslint e com ele brace-expansion; `vite` usa postcss. Nada disso chega ao browser, e nada disso é corrigível aqui, porque está upstream. Um `bun update` piorou o quadro, de seis para nove.

Ficou com `--prod`, que reduz ao que é alcançável a partir de `dependencies`, e com `continue-on-error: true`. Um advisory numa dependência que embarca (react, tanstack, zod, radix) aparece no log e merece ação; um advisory numa CLI que você roda à mão para criar um botão não é motivo para travar entrega.

Duas ressalvas registradas porque não são óbvias. `bun audit` ignora flag desconhecida em silêncio, em vez de reclamar, então `--prod` sumir numa versão futura do bun alarga a checagem de volta sem avisar (inofensivo enquanto o step não pode falhar). E `--prod` só é uma linha divisória honesta quando `dependencies` contém apenas o que embarca: hoje `tailwindcss`, `@tailwindcss/vite` e `tw-animate-css` estão lá e são ferramentas de build, então mesmo com `--prod` sobra postcss.

**As actions do CI estão fixadas por SHA, a imagem do Semgrep não.** Uma tag como `v4` é um ponteiro móvel: quem publica a action pode reapontar para código que ninguém revisou, e o CI passa a rodar outra coisa sem nenhum diff. Por isso `actions/checkout` e `oven-sh/setup-bun` aparecem como hash de commit com a versão num comentário ao lado, e os três checkouts usam `persist-credentials: false`, já que nenhum job aqui dá push. O token do workflow inteiro é `contents: read`.

O custo é congelamento: sem Dependabot configurado para actions, esses hashes ficam parados até alguém atualizar à mão. Atualize o SHA e o comentário de versão juntos, senão o comentário mente. A imagem `semgrep/semgrep` ficou na tag flutuante de propósito, porque ela existe para trazer regra nova, e fixar por digest desliga justamente isso.

**Semgrep roda só no CI, em container, com `p/react` e `p/typescript`.** O `p/owasp-top-ten` foi considerado e ficou de fora: metade dele procura sinks que um SPA client-only não tem, e o que sobra o oxlint já pega. Pelo mesmo motivo o Semgrep não entra no loop local. O `semgrep-action` está deprecado; o container `semgrep/semgrep` é o caminho suportado e dispensa instalar Python no runner.

**Mutation testing ficou de fora, depois de tentado.** Stryker 9.6.1 com `@hughescr/stryker-bun-runner` 1.3.8 foi instalado, configurado e rodado. Ele importa a API programática do compilador (`ts.parseConfigFileTextToJson`), que o TypeScript 7.0 não expõe, então o pré-processador de tsconfig quebra na largada. Com o contorno `"tsconfigFile": ""` o run completa, mas a instrumentação fica sem a informação de tsconfig: 80 dos 116 mutantes voltaram como `error` e nenhum como `killed`. Um score não medido apresentado como número é pior que não ter número, então a ferramenta saiu. Se voltar depois da API estável no TS 7.1, o caminho é `bun add -d @stryker-mutator/core @hughescr/stryker-bun-runner`, uma `stryker.config.json` sem o `tsconfigFile` vazio, e um job nightly com `continue-on-error`, nunca um check de PR.

**O `react-doctor` fica, mas não vira gate local.** Depois de ligar `react-perf` e as regras type-aware no oxlint, um run limpo do react-doctor dá 55/100 com dez warnings, e todos os dez são sobreposição (`only-export-components`, que o oxlint já tem) ou falso positivo (ele lista `@oxlint/plugins` como devDependency órfã, quando ela é usada via `jsPlugins` no `.oxlintrc.json`). Isso não prova que as categorias Security, Bugs e Performance dele sejam redundantes, só que este repo está limpo nelas. Fica no CI, onde reporta apenas o que o PR introduziu e não custa nada ao loop local.

## Onde este repo diverge do template de origem

**O lugar do CodeRabbit é do `adversarial-review.yml`.** O template de origem tinha um review adversarial de duas etapas em CI, deletou os dois arquivos quando adotou o bot do CodeRabbit, e passou a chamar o bot na fase 8. Aqui não há CodeRabbit, então o workflow ficou: `propose` levanta todo achado com citação `file:line`, confiança e comando de verificação; `skeptic` forma impressão própria do diff antes de ler os achados, verifica cada um com comando de verdade, e posta só o que sobrevive. `REVIEW.md` é a régua de severidade que as duas etapas leem.

A troca não é só de nome. O CodeRabbit revisa fora da sessão e de graça; este roda pela assinatura do Claude e precisa do secret `CLAUDE_CODE_OAUTH_TOKEN` no repo. Sem o secret, a Action falha na auth em vez de simplesmente não postar, então repo novo a partir deste template tem que gerar o token com `claude setup-token` antes do primeiro PR.

Duas inércias são de desenho, não bug: a `claude-code-action` se recusa a rodar quando o arquivo do workflow diverge da cópia da default branch (guarda contra PR que adultera o review pra vazar secret), e PR de fork é pulado porque fork não recebe secret.

**Fase 6 e fase 8 são lanes independentes, não a mesma coisa duas vezes.** O `review-judgment` roda local, contra a árvore de trabalho, antes do PR existir, e o hook de `gh pr create` cobra o verdict dele. O workflow roda em CI, contra o diff empurrado, depois. Um pega o que o outro não vê: o local pega antes de gastar um push, o de CI pega o que entrou depois da última rodada local e não depende de ninguém lembrar de rodar.

**Pin de action é no major que o arquivo já usava.** O template de origem pina `actions/checkout` em v4.4.0; aqui o repo já estava em v7, e copiar o hash de lá seria regressão de três majors travada por SHA. A regra adotada foi: fixar por SHA sem mudar major. `upload-artifact` e `download-artifact` ficaram em v4 mesmo com v7 e v8 publicados, porque pular três ou quatro majors em action de artifact tem breaking change de comportamento e merece PR própria com teste.

`anthropics/claude-code-action@v1` e `millionco/react-doctor@v2` continuam em tag flutuante. Inconsistente com o resto de propósito: a primeira já tem a própria guarda de divergência com a default branch, e fixar qualquer uma das duas exige um plano de bump que ninguém escreveu ainda.

**O `docs/anti-slop-guidelines.md` é cópia versionada, não fonte.** A fonte é https://files.barreto.sh/slop.md. Está versionado aqui pra que hook, agente e CI não dependam de rede pra ler a regra, e porque o `require-review` bloqueia PR sem conseguir explicar por quê se a regra estiver fora de alcance. O custo é drift: ao mexer no upstream, traga a mudança no mesmo PR.

## Editar um charter não afeta a sessão em curso

Descoberto na prática ao refazer este pipeline: o Claude Code lê `.claude/agents/*.md` quando a sessão carrega, então um `review-judgment` spawnado depois de você editar o charter ainda roda com a versão antiga. O reviewer notou isso sozinho, comparando o system prompt que recebeu com o arquivo em disco.

Consequência: mudou o charter, reinicie a sessão antes de confiar no escopo novo, ou passe a instrução nova no prompt do agente. Vale principalmente quando a edição adiciona responsabilidade, como o item de segredos, porque aí o silêncio do reviewer não significa que ele olhou.

## O que ficou verificado, e o que não

**`stop_hook_active` existe, mesmo fora da doc.** O campo saiu da doc de hooks, então foi medido: um hook de captura gravou o payload real do evento `Stop`, e ele veio com `session_id`, `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `effort`, `hook_event_name`, `stop_hook_active`, `last_assistant_message`, `background_tasks` e `session_crons`, com `stop_hook_active: false`. O early-exit em `require-doctor.ts` é proteção viva contra o loop infinito que as issues #55754 e #58348 do `anthropics/claude-code` relatam, não código morto. O que não foi medido é se o campo vira `true` numa segunda parada do mesmo ciclo, porque isso exigiria deixar o `doctor` vermelho de propósito. Se virar, o gate bloqueia uma vez por ciclo e a rede de segurança real é o hook de `gh pr create`, que re-roda o `doctor` do zero.

**Não existe limite documentado de blocks consecutivos do Stop hook.** O relatório que originou este trabalho afirmava que a doc oficial diz que o Claude Code sobrepõe o hook depois de 8 blocks consecutivos. Essa frase não está na doc. O risco documentado é o oposto, loop infinito.
