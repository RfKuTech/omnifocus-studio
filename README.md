# OmniFocus Studio
Aplicação de aprendizagem gamificada com aulas visuais narradas, pausas para perguntas, missões práticas e simulado final.

## Executar e testar
Node 20 ou superior. `npm test` valida as respostas da IA, fontes de vídeo, limites e OAuth. `npm run check` verifica os scripts. O frontend estático pode ser servido com `python -m http.server`; a geração e o OAuth precisam dos endpoints hospedados na Vercel.

## Configuração na Vercel
- `GEMINI_API_KEY`: chave do Google AI, somente no servidor.
- `GEMINI_MODEL`: opcional, padrão `gemini-2.5-flash`. O modelo precisa aceitar vídeos públicos do YouTube e JSON.
- `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`: credenciais de uma **OAuth App**, criada nas configurações de desenvolvedor do GitHub. Callback: URL exata da página do aplicativo (por exemplo `https://omnifocus-studio.vercel.app/`). O fluxo solicita somente `gist`, usa state e PKCE e troca o código no servidor.
- `APP_ORIGINS`: origens permitidas, separadas por vírgulas. Padrão: `https://omnifocus-studio.vercel.app,https://rfkutech.github.io`. Para outra instalação, configure a origem e o callback correspondentes.
- Faça novo deploy após configurar variáveis. `api/generate.js` requer até 120 segundos; confira se o plano da hospedagem comporta esse tempo.

## Google pessoal e nuvem
O botão Google abre o seletor de contas e solicita Drive `appDataFolder` e perfil. O Client ID público está em `index.html`: configure no Google Cloud as origens JavaScript autorizadas e habilite a API Drive. Em aplicativo OAuth em teste, adicione os usuários de teste; para outros usuários, configure a publicação da tela de consentimento. A sessão de acesso expira e o usuário precisa reconectar. Nunca coloque Client Secret no frontend.

Google salva em pasta privada do aplicativo no Drive. GitHub salva em Gist não listado: qualquer pessoa com o link pode lê-lo. Aulas, XP, sequência e missões concluídas são sincronizados. A troca de contas mantém bibliotecas locais separadas. No primeiro login, o material local é associado à conta escolhida. Tokens são armazenados no navegador; use em dispositivos confiáveis.

## Materiais e aula
- PDF com texto, DOCX, TXT, MD, CSV, JSON e imagens PNG/JPEG/WebP (OCR em português). Até 20 MB por arquivo e 180 mil caracteres por aula; o sistema rejeita excesso, sem cortar o material silenciosamente.
- PDF escaneado sem camada de texto: envie suas páginas como imagens. Arquivos de áudio/vídeo locais, PPTX, planilhas binárias e demais formatos não são convertidos automaticamente.
- Até cinco links públicos do YouTube, enviados à IA junto ao texto completo. Vídeos privados, indisponíveis ou incompatíveis com a API produzem erro; não se gera uma aula fictícia como contingência.
- A aula é uma apresentação visual narrada no navegador, não um arquivo MP4 renderizado. Cada cena reúne conceitos das fontes, pode reproduzir um trecho do YouTube e pausa para um questionário. A navegação exige resposta correta; o botão “Terminei de ler” oferece alternativa à voz.
- O simulado final contém questões próprias, nota e tempo de 10 minutos. A missão prática aparece após cada conceito.
- Bibliotecas antigas continuam disponíveis; novas aulas incluem narrativa, cenas e simulado.

## Validação e limites
Os testes locais usam respostas simuladas do modelo. A qualidade e os timestamps dependem da análise da IA. OAuth real, Drive, Gist e geração com a chave de produção devem ser verificados após a configuração de credenciais e implantação. A API de geração não exige login e consome a cota do servidor; configure limites de uso na hospedagem antes de abrir acesso em larga escala.
