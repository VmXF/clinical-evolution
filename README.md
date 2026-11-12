# Evolução Clínica Offline

PWA local para gerar texto de evolução de enfermaria. Não é um sistema de prontuário nem oferece suporte à decisão clínica.

## Instalação no Android

1. Hospede esta pasta em um endereço HTTPS ou abra-a pelo servidor local da instituição; a instalação por PWA exige um contexto seguro (HTTPS ou localhost).
2. No Chrome para Android, abra o endereço e use **⋮ > Instalar app** (ou **Adicionar à tela inicial**).
3. Abra o ícone instalado uma vez com conexão disponível para o carregamento inicial. Depois, a aplicação funciona offline.

## Uso

Preencha e selecione apenas o que deve constar na evolução. Selecione **Gerar evolução** e depois **Copiar**. Campos, seções e pendências não preenchidos ou não marcados são omitidos. O aplicativo não salva automaticamente dados identificáveis.

## Validação recomendada antes de uso institucional

Abra a aplicação instalada, desligue a conexão do dispositivo, reabra-a e gere uma evolução de teste. Confirme também as políticas locais de segurança da informação e de registro em prontuário.

## Gerenciamento local da enfermaria

- A tela inicial permite cadastrar pacientes em leitos, adicionar/remover leitos e abrir o histórico individual.
- Cada evolução é salva como registro independente, com data editável. O DIH é calculado pela data de internação e pela data da evolução, sem depender de haver visita em todos os dias.
- A data de internação pode ser corrigida na tela do paciente; os DIH históricos são recalculados sem alterar o texto nem a data das evoluções.
- Pendências são mantidas separadamente, com conclusão e data, e também podem ser capturadas do campo Pendências do gerador ao salvar uma evolução.
- A página individual apresenta histórico de evoluções, pendências longitudinais e painel persistente de antibioticoterapia.
- A antibioticoterapia é cadastrada por paciente, com seletor institucional, opção de nome livre e data de início. ATBs podem ser finalizados ou suspensos; a ação registra a data atual, mantém o histórico e cria automaticamente uma evolução datada.
- A data de internação permanece no cadastro do paciente e é usada para calcular o DIH; não é repetida no formulário de evolução.
- Os registros ficam no IndexedDB do navegador neste dispositivo. Exporte backups JSON regularmente. A restauração substitui os dados locais atuais.

O uso como PWA requer servir os arquivos em HTTPS ou localhost. Após abrir/instalar e armazenar o app shell, a interface pode ser carregada offline. O armazenamento local não é sincronizado nem criptografado automaticamente.
