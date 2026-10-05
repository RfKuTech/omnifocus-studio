# OmniFocus Studio
Cursos por capítulos com animações didáticas narradas, exemplos resolvidos, pausas de compreensão, estudos de caso e simulados.

## Executar e testar
Node 20 ou superior. `npm ci && npm run build` gera o CSS local (sem depender do CDN do Tailwind). `npm test` valida contratos, fontes, limites, erros do provedor e OAuth. `npm run check` verifica os scripts.

`CHROMIUM_PATH=/caminho/para/chromium npm run test:browser` inicia um servidor local e verifica reprodução, pausa/retomada, interrupção automática em questionários, bloqueio de avanço, resolução de caso, notas, biblioteca e layout móvel. Usa narração simulada e dados de teste; não chama a IA nem serviços de nuvem. As capturas são gravadas em `/tmp` ou `SCREENSHOTS_DIR`.

O CSS compilado é versionado. A Vercel serve os arquivos diretamente, sem instalar dependências de desenvolvimento nem executar o build; ao alterar classes, execute `npm run build` antes do commit.

O frontend estático pode ser servido com `python -m http.server`; a geração e o OAuth precisam dos endpoints hospedados na Vercel.

## Configuração na Vercel
- `GEMINI_API_KEY`: chave do Google AI, somente no servidor.
- `GEMINI_MODEL`: opcional, padrão `gemini-3.5-flash-lite`. O modelo precisa aceitar vídeos públicos do YouTube e JSON.
- `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`: credenciais de uma **OAuth App**, criada nas configurações de desenvolvedor do GitHub. Callback: URL exata da página do aplicativo (por exemplo `https://omnifocus-studio.vercel.app/`). O fluxo solicita somente `gist`, usa state e PKCE e troca o código no servidor.
- `APP_ORIGINS`: origens permitidas, separadas por vírgulas. Padrão: `https://omnifocus-studio.vercel.app,https://rfkutech.github.io`. Para outra instalação, configure a origem e o callback correspondentes.
- Faça novo deploy após configurar variáveis. `api/generate.js` e `api/course.js` requerem até 120 segundos; confira se o plano da hospedagem comporta esse tempo.

## Google pessoal e nuvem
O botão Google abre o seletor de contas e solicita Drive `appDataFolder` e perfil. O Client ID público está em `index.html`: configure no Google Cloud as origens JavaScript autorizadas e habilite a API Drive. Em aplicativo OAuth em teste, adicione os usuários de teste; para outros usuários, configure a publicação da tela de consentimento. A sessão de acesso expira e o usuário precisa reconectar. Nunca coloque Client Secret no frontend.

Google salva em pasta privada do aplicativo no Drive. GitHub salva em Gist não listado: qualquer pessoa com o link pode lê-lo. Aulas, XP, sequência e missões concluídas são sincronizados. A troca de contas mantém bibliotecas locais separadas. No primeiro login, o material local é associado à conta escolhida. Tokens são armazenados no navegador; use em dispositivos confiáveis.

## Materiais e aula
- PDF com texto, DOCX, TXT, MD, CSV, JSON e imagens PNG/JPEG/WebP (OCR em português). Até 20 MB por arquivo e 180 mil caracteres por aula; o sistema rejeita excesso, sem cortar o material silenciosamente.
- PDF escaneado sem camada de texto: envie suas páginas como imagens. Arquivos de áudio/vídeo locais, PPTX, planilhas binárias e demais formatos não são convertidos automaticamente.
- Até cinco links públicos do YouTube, enviados à IA junto ao texto completo. Vídeos privados, indisponíveis ou incompatíveis com a API produzem erro; não se gera uma aula fictícia como contingência.
- O formato padrão é **Curso animado por capítulos**. Primeiro o sistema planeja de 2 a 12 capítulos e mapeia conceitos a todas as fontes. O estudante desenvolve cada capítulo quando precisar, evitando uma única geração longa para o curso inteiro.
- Cada capítulo tem de 5 a 10 cenas, ao menos 650 palavras de narração, exemplo resolvido, aplicação e no mínimo duas pausas com perguntas. Os esquemas aparecem e se destacam junto à narração: fluxos, comparações, cálculos, gráficos, linhas do tempo, conceitos e frações. A API recusa capítulos que não atendem ao contrato.
- Trata-se de animação didática reproduzida no navegador, com voz do dispositivo; não gera nem exporta um MP4. O conteúdo de YouTube é integrado pela IA às explicações. A voz depende do suporte e das vozes disponíveis no navegador; há alternativa de legendas e leitura completa.
- O estudo de caso exige resposta escrita e apresenta critérios e resolução comentada. A avaliação do texto é feita pelo próprio estudante, explicitamente identificada como autoavaliação. Cada capítulo tem 4 a 8 questões próprias com justificativas de todas as alternativas. O simulado integrador reúne de 8 a 16 questões cobrindo todos os capítulos.
- Cenas, respostas e progresso ficam na biblioteca e seguem a sincronização de nuvem existente. Falhas de geração preservam as etapas já salvas e permitem tentar novamente.
- Aulas antigas continuam disponíveis em seu formato original. Na biblioteca, **Criar curso aprofundado** reaproveita os materiais preservados para planejar um novo curso. Elas não se transformam automaticamente em cursos novos. A exportação PDF continua disponível apenas para o formato antigo.

## Validação e limites
Os testes locais usam respostas simuladas do modelo. O mapeamento valida referências, não a exatidão semântica: a qualidade factual e pedagógica ainda depende da análise da IA e deve ser revisada. OAuth real, Drive, Gist e geração com a chave de produção devem ser verificados após a configuração de credenciais e implantação. A API de geração não exige login e consome a cota do servidor; configure limites de uso na hospedagem antes de abrir acesso em larga escala.
