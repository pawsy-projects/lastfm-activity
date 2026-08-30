import { storage } from "@vendetta/plugin";

export const dict = {
  pt: {
    synced: "sincronizado!",
    active: "ativo!",
    noUserErr: "Abra a configuração para setar seu username.",
    nothing: "Tocando nada",
    userNotFound: "Usuário não achado",
    userReq: "Usuário é necessário",
    err: "Erro: ",
    noNav: "Não disponível",
    noFlux: "flux.dispatcher não encontrado",
    
    cmdDesc: "Forçar sincronização do Last.fm",
    secAuth: "LOGAR:",
    secOpts: "OPÇÕES:",
    secAct: "OPÇÕES DE ATIVIDADE:",
    secCredits: "CRÉDITOS:",
    
    login: "Login & conta",
    linked: "A conta vinculada que será registrada nas atividades!",
    noUser: "Nenhum usuário logado.",
    saveBtn: "Validar e salvar a conta!",
    syncData: "A conta será sincronizada, certifique se escreveu seu username corretamente!",
    connected: "Conectado como: @",
    
    userField: "Nome da sua conta:",
    userPlace: "Digite aqui...",
    
    intervalField: "Tempo de sincronização (segundos):",
    toastToggle: "Notificar troca de música",
    toastSub: "Exibe um pequeno pop-up quando a música for atualizada.",
    btnToggle: "Botão de perfil",
    btnSub: "Acessar seu perfil na atividade (beta).",
    forceBtn: "Forçar sincronização",
    forceSub: "Atualize agora ignorando o intervalo.",
    
    subTitle: "Mostre para todos o que você está ouvindo na Last.fm de uma forma fácil e simples!",
    actSettings: "Configurações da atividade",
    actSettingsSub: "Personalize o tempo de intervalo, pop-up e botão.",
    profileBtn: "Perfil Last.fm",
    by: "de "
  }
};

export function t(k) {
  const lang = storage.lang || "pt";
  return dict[lang]?.[k] || dict["pt"]?.[k] || k;
}
