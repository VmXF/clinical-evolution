(() => {
  "use strict";

  const DB_NAME = "minha-enfermaria-local";
  const DB_VERSION = 1;
  const STORE_NAME = "app";
  const STATE_KEY = "state";
  const BACKUP_HANDLE_KEY = "external-backup-file-handle";
  const DEFAULT_BEDS = ["101", "102", "103"];
  const ANTIBIOTICS = [
    "Amicacina", "Amoxicilina/Clavulanato", "Ampicilina", "Ampicilina/Sulbactam",
    "Azitromicina", "Bactrim", "Cefalotina", "Cefazolina", "Cefepime", "Ceftriaxona",
    "Cefuroxima", "Ciprofloxacina", "Claritromicina", "Clindamicina", "Daptomicina",
    "Gentamicina", "Imipenem", "Levofloxacina", "Linezolida", "Meropenem", "Metronidazol",
    "Moxifloxacina", "Oxacilina", "Penicilina cristalina", "Piperacilina/Tazobactam",
    "Polimixina B", "Rifampicina", "Teicoplanina", "Tigeciclina", "Vancomicina"
  ];

  const $ = selector => document.querySelector(selector);
  let db;
  let state = { beds: [...DEFAULT_BEDS], patients: [] };
  let currentPatientId = null;
  let modalCleanup = null;
  let externalBackupHandle = null;
  let externalBackupWriting = false;
  let externalBackupPending = false;
  let externalBackupLastSavedAt = null;
  let externalBackupStatus = "unconfigured";
  let storageIsPersistent = null;

  function uid() {
    return window.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function localISO(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const result = new Date(Date.UTC(y, m - 1, d));
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function dayNumber(admissionDate, referenceDate = localISO()) {
    const start = parseISO(admissionDate);
    const end = parseISO(referenceDate);
    if (!start || !end) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  }

  function fmtDate(iso) {
    const date = parseISO(iso);
    if (!date) return "Data não informada";
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  }

  function toShortDate(iso) {
    const date = parseISO(iso);
    if (!date) return "";
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCFullYear()).slice(-2)}`;
  }

  function toDayMonth(iso) {
    const date = parseISO(iso);
    if (!date) return "";
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function getPatient(id) {
    return state.patients.find(patient => patient.id === id) || null;
  }

  function activePatients() {
    return state.patients.filter(patient => patient.status !== "archived");
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("Este navegador não disponibiliza IndexedDB."));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Falha ao abrir o armazenamento local."));
      request.onblocked = () => reject(new Error("O armazenamento está bloqueado por outra aba do aplicativo."));
    });
  }

  function readState() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Falha ao ler os dados locais."));
    });
  }

  function readAppValue(key) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("Falha ao ler a configuração local."));
    });
  }

  function writeAppValue(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao gravar a configuração local."));
      transaction.onabort = () => reject(transaction.error || new Error("Gravação da configuração cancelada."));
    });
  }

  function makeBackupPayload() {
    return { app: "Minha Enfermaria", version: 1, exportedAt: new Date().toISOString(), state };
  }

  function persist() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
      transaction.oncomplete = () => {
        resolve();
        scheduleExternalBackup();
      };
      transaction.onerror = () => reject(transaction.error || new Error("Falha ao gravar os dados locais."));
      transaction.onabort = () => reject(transaction.error || new Error("Gravação local cancelada."));
    });
  }

  function showToast(message) {
    let toast = $("#managerToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "managerToast";
      toast.className = "manager-toast";
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function updateExternalBackupUI() {
    const button = $("#configureExternalBackupButton");
    const changeButton = $("#changeExternalBackupButton");
    const notice = $("#externalBackupNotice");
    if (!button || !notice) return;

    changeButton.hidden = !externalBackupHandle;
    if (!externalBackupHandle) {
      button.textContent = "Configurar backup automático";
      notice.textContent = "Nenhum arquivo externo configurado. Escolha um arquivo JSON em uma pasta do celular para receber as cópias automáticas.";
      notice.dataset.status = "off";
      return;
    }

    if (externalBackupStatus === "active") {
      button.textContent = "Sincronizar backup agora";
      const when = externalBackupLastSavedAt ? ` · Última cópia: ${externalBackupLastSavedAt.toLocaleString("pt-BR")}` : "";
      notice.textContent = `Backup automático ativo: ${externalBackupHandle.name || "arquivo JSON"}${when}.`;
      notice.dataset.status = "ok";
    } else if (externalBackupStatus === "syncing") {
      button.textContent = "Backup automático ativo";
      notice.textContent = `Atualizando ${externalBackupHandle.name || "o arquivo JSON"}…`;
      notice.dataset.status = "pending";
    } else if (externalBackupStatus === "permission") {
      button.textContent = "Reautorizar backup automático";
      notice.textContent = `Arquivo configurado: ${externalBackupHandle.name || "backup JSON"}. O Chrome precisa que você autorize novamente o acesso para continuar atualizando o arquivo.`;
      notice.dataset.status = "warn";
    } else {
      button.textContent = "Tentar backup automático novamente";
      notice.textContent = `Arquivo configurado: ${externalBackupHandle.name || "backup JSON"}, mas a última gravação falhou. ${externalBackupStatus === "error" ? "Verifique se o arquivo ou a pasta continuam disponíveis." : ""}`;
      notice.dataset.status = "warn";
    }
  }

  function updateStorageProtectionUI() {
    const notice = $("#storageNotice");
    const button = $("#protectStorageButton");
    if (!notice) return;
    if (storageIsPersistent === true) {
      notice.textContent = "Armazenamento local protegido contra remoção automática por pressão de espaço. A exclusão manual dos dados do site continua podendo apagá-los.";
      notice.dataset.status = "ok";
      if (button) button.hidden = true;
    } else if (storageIsPersistent === false) {
      notice.textContent = "Proteção persistente não concedida pelo navegador. O backup externo automático é recomendado.";
      notice.dataset.status = "warn";
      if (button) button.hidden = false;
    } else {
      notice.textContent = "Verificando proteção do armazenamento local…";
      notice.dataset.status = "pending";
    }
  }

  async function refreshStorageProtection(requestProtection = false) {
    if (!navigator.storage || typeof navigator.storage.persisted !== "function") {
      storageIsPersistent = null;
      const notice = $("#storageNotice");
      if (notice) {
        notice.textContent = "Este navegador não disponibiliza a verificação de armazenamento persistente.";
        notice.dataset.status = "warn";
      }
      const button = $("#protectStorageButton");
      if (button) button.hidden = true;
      return;
    }
    try {
      let persisted = await navigator.storage.persisted();
      if (!persisted && requestProtection && typeof navigator.storage.persist === "function") {
        persisted = await navigator.storage.persist();
      }
      storageIsPersistent = Boolean(persisted);
    } catch (_) {
      storageIsPersistent = false;
    }
    updateStorageProtectionUI();
  }

  async function protectLocalStorage() {
    await refreshStorageProtection(true);
    showToast(storageIsPersistent ? "Proteção persistente concedida." : "O navegador não concedeu a proteção persistente.");
  }

  async function loadExternalBackupHandle() {
    try {
      externalBackupHandle = await readAppValue(BACKUP_HANDLE_KEY);
      if (!externalBackupHandle) {
        externalBackupStatus = "unconfigured";
        updateExternalBackupUI();
        return;
      }
      const permission = typeof externalBackupHandle.queryPermission === "function"
        ? await externalBackupHandle.queryPermission({ mode: "readwrite" })
        : "prompt";
      externalBackupStatus = permission === "granted" ? "active" : "permission";
      updateExternalBackupUI();
      if (permission === "granted") scheduleExternalBackup();
    } catch (_) {
      externalBackupStatus = "error";
      updateExternalBackupUI();
    }
  }

  async function writeExternalBackupFile(handle) {
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(makeBackupPayload(), null, 2));
      await writable.close();
      externalBackupLastSavedAt = new Date();
      externalBackupStatus = "active";
      updateExternalBackupUI();
    } catch (error) {
      try { await writable.abort(); } catch (_) { /* mantém o erro original */ }
      throw error;
    }
  }

  function scheduleExternalBackup() {
    if (!externalBackupHandle) return;
    externalBackupPending = true;
    if (externalBackupStatus !== "permission" && externalBackupStatus !== "error") externalBackupStatus = "syncing";
    updateExternalBackupUI();
    if (!externalBackupWriting) void processExternalBackupQueue();
  }

  async function processExternalBackupQueue() {
    if (externalBackupWriting || !externalBackupHandle) return;
    externalBackupWriting = true;
    try {
      while (externalBackupPending && externalBackupHandle) {
        externalBackupPending = false;
        const handle = externalBackupHandle;
        const permission = typeof handle.queryPermission === "function"
          ? await handle.queryPermission({ mode: "readwrite" })
          : "prompt";
        if (permission !== "granted") {
          externalBackupStatus = "permission";
          updateExternalBackupUI();
          break;
        }
        try {
          await writeExternalBackupFile(handle);
        } catch (error) {
          externalBackupStatus = "error";
          updateExternalBackupUI();
          console.warn("Backup externo não atualizado:", error);
          break;
        }
      }
    } catch (error) {
      externalBackupStatus = "error";
      updateExternalBackupUI();
      console.warn("Falha na rotina de backup externo:", error);
    } finally {
      externalBackupWriting = false;
      if (externalBackupPending && externalBackupHandle) void processExternalBackupQueue();
    }
  }

  function externalBackupPickerOptions() {
    return {
      id: "minha-enfermaria-backup",
      suggestedName: "backup-minha-enfermaria.json",
      types: [{
        description: "Backup da Minha Enfermaria (JSON)",
        accept: { "application/json": [".json"] }
      }]
    };
  }

  async function chooseExternalBackupFile() {
    if (typeof window.showSaveFilePicker !== "function") {
      showToast("Este navegador não permite gravação automática em arquivo. Use Exportar backup manual.");
      return;
    }
    try {
      // O seletor é chamado diretamente a partir do clique do usuário.
      const handle = await window.showSaveFilePicker(externalBackupPickerOptions());
      externalBackupHandle = handle;
      await writeAppValue(BACKUP_HANDLE_KEY, handle);
      externalBackupStatus = "active";
      updateExternalBackupUI();
      scheduleExternalBackup();
      showToast("Arquivo externo configurado. As próximas alterações serão copiadas automaticamente enquanto a permissão estiver ativa.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        externalBackupStatus = "error";
        updateExternalBackupUI();
        showToast(error.message || "Não foi possível configurar o arquivo de backup.");
      }
    }
  }

  async function manageExternalBackup() {
    if (!externalBackupHandle) {
      await chooseExternalBackupFile();
      return;
    }
    try {
      // requestPermission é invocado pelo gesto explícito do usuário.
      const permission = await externalBackupHandle.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        externalBackupStatus = "permission";
        updateExternalBackupUI();
        showToast("O acesso ao arquivo não foi autorizado.");
        return;
      }
      externalBackupStatus = "active";
      updateExternalBackupUI();
      scheduleExternalBackup();
      showToast("Permissão concedida. O backup será atualizado agora e nas próximas alterações.");
    } catch (error) {
      externalBackupStatus = "error";
      updateExternalBackupUI();
      showToast(error.message || "Não foi possível atualizar o backup externo.");
    }
  }

  async function changeExternalBackupFile() {
    await chooseExternalBackupFile();
  }

  function showModal(title, bodyHTML, onSubmit, submitLabel = "Salvar") {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "manager-modal-backdrop";
    backdrop.innerHTML = `
      <div class="manager-modal" role="dialog" aria-modal="true" aria-labelledby="managerModalTitle">
        <div class="manager-modal-head"><h2 id="managerModalTitle">${escapeHTML(title)}</h2><button type="button" class="icon-close" aria-label="Fechar">×</button></div>
        <form class="manager-modal-form">
          <div class="manager-modal-content">${bodyHTML}</div>
          <div class="manager-modal-actions"><button type="button" class="secondary cancel-modal">Cancelar</button><button type="submit" class="primary">${escapeHTML(submitLabel)}</button></div>
        </form>
      </div>`;
    document.body.append(backdrop);
    const form = backdrop.querySelector("form");
    backdrop.querySelectorAll(".icon-close,.cancel-modal").forEach(button => button.addEventListener("click", closeModal));
    backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      try {
        await onSubmit(new FormData(form), form);
      } catch (error) {
        showToast(error.message || "Não foi possível concluir a operação.");
      }
    });
    const firstInput = form.querySelector("input,select,textarea,button");
    firstInput?.focus();
    modalCleanup = () => backdrop.remove();
  }

  function closeModal() {
    if (modalCleanup) modalCleanup();
    modalCleanup = null;
  }

  function showScreen(screen) {
    $("#managerHome").hidden = screen !== "home";
    $("#patientScreen").hidden = screen !== "patient";
    $("#generatorScreen").hidden = screen !== "generator";
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderHome() {
    const grid = $("#bedGrid");
    grid.replaceChildren();
    state.beds.forEach(bed => {
      const patient = activePatients().find(item => item.bed === bed);
      const card = document.createElement("article");
      card.className = `bed-card${patient ? " occupied" : " empty"}`;
      const status = patient
        ? `${patient.evolutions.length} evolução(ões) · ${patient.pendings.filter(item => !item.done).length} pendência(s) aberta(s)`
        : "Leito disponível";
      const day = patient ? dayNumber(patient.admissionDate) : null;
      card.innerHTML = `
        <button type="button" class="bed-open">
          <span class="bed-number">Leito ${escapeHTML(bed)}</span>
          <span class="bed-patient">${patient ? escapeHTML(patient.label || "Paciente cadastrado") : "Adicionar paciente"}</span>
          <span class="bed-meta">${escapeHTML(status)}</span>
          ${patient ? `<span class="bed-day">${day && day > 0 ? `D${day}` : "Conferir DIH"}</span>` : "<span class=\"bed-day\">+</span>"}
        </button>
        ${patient ? "" : `<button type="button" class="remove-bed" aria-label="Remover leito ${escapeHTML(bed)}">×</button>`}`;
      card.querySelector(".bed-open").addEventListener("click", () => patient ? openPatient(patient.id) : createPatient(bed));
      card.querySelector(".remove-bed")?.addEventListener("click", async () => {
        if (!confirm(`Remover o leito ${bed} da tela inicial?`)) return;
        state.beds = state.beds.filter(item => item !== bed);
        await persist();
        renderHome();
      });
      grid.append(card);
    });

    const active = activePatients();
    const allOpen = active.reduce((sum, patient) => sum + patient.pendings.filter(item => !item.done).length, 0);
    $("#activeCount").textContent = String(active.length);
    $("#openPendingCount").textContent = String(allOpen);
    renderArchivedPatients();
    $("#addBedButton").disabled = false;
  }

  function monthFolderLabel(isoMonth) {
    const [year, month] = isoMonth.split("-").map(Number);
    const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${names[month - 1]}/${year}`;
  }

  function renderArchivedPatients() {
    const archivedSection = $("#archivedPatients");
    const archived = state.patients.filter(patient => patient.status === "archived");
    archivedSection.hidden = archived.length === 0;
    if (!archived.length) {
      archivedSection.replaceChildren();
      return;
    }

    // A alta é a chave de organização; o ID interno permanece como identidade
    // real do registro, pois o número do leito pode ser reutilizado.
    const months = new Map();
    archived.forEach(patient => {
      const dischargeDate = parseISO(patient.dischargedAt) ? patient.dischargedAt : "sem-data";
      const monthKey = dischargeDate === "sem-data" ? "0000-00" : dischargeDate.slice(0, 7);
      if (!months.has(monthKey)) months.set(monthKey, new Map());
      const days = months.get(monthKey);
      if (!days.has(dischargeDate)) days.set(dischargeDate, []);
      days.get(dischargeDate).push(patient);
    });

    const monthHTML = [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([monthKey, days], monthIndex) => {
        const monthLabel = monthKey === "0000-00" ? "Data de alta não informada" : monthFolderLabel(monthKey);
        const count = [...days.values()].reduce((sum, patients) => sum + patients.length, 0);
        const dayHTML = [...days.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, patients]) => `
            <section class="archive-day">
              <h3>${date === "sem-data" ? "Data não informada" : fmtDate(date)}</h3>
              <div class="archive-day-list">${patients.sort((a, b) => String(a.bed).localeCompare(String(b.bed), "pt-BR", { numeric: true })).map(patient => `
                <div class="archive-entry">
                  <button type="button" class="archive-open" data-patient-id="${escapeHTML(patient.id)}">
                    <span class="archive-entry-title">Leito ${escapeHTML(patient.bed)} — Internação ${toDayMonth(patient.admissionDate)}</span>
                    ${patient.label ? `<small>${escapeHTML(patient.label)}</small>` : ""}
                  </button>
                  <button type="button" class="archive-delete" data-delete-patient-id="${escapeHTML(patient.id)}" aria-label="Excluir registro do leito ${escapeHTML(patient.bed)}" title="Excluir registro">Excluir</button>
                </div>`).join("")}</div>
            </section>`).join("");
        return `
          <details class="archive-month" ${monthIndex === 0 ? "open" : ""}>
            <summary><span>${escapeHTML(monthLabel)}</span><small>${count} registro(s)</small></summary>
            <div class="archive-month-content">${dayHTML}</div>
          </details>`;
      }).join("");

    archivedSection.innerHTML = `
      <div class="archive-folder-heading"><h2>Altas</h2><span>${archived.length} registro(s)</span></div>
      <div class="archive-months">${monthHTML}</div>`;

    archivedSection.querySelectorAll("[data-patient-id]").forEach(button => {
      button.addEventListener("click", () => openPatient(button.dataset.patientId));
    });
    archivedSection.querySelectorAll("[data-delete-patient-id]").forEach(button => {
      button.addEventListener("click", () => deleteArchivedPatient(button.dataset.deletePatientId));
    });
  }

  async function deleteArchivedPatient(id) {
    const patient = getPatient(id);
    if (!patient || patient.status !== "archived") return;
    const description = `Leito ${patient.bed} — internação ${fmtDate(patient.admissionDate)} — alta ${fmtDate(patient.dischargedAt)}`;
    if (!confirm(`Excluir definitivamente este registro?\n\n${description}\n\nEsta ação não poderá ser desfeita.`)) return;
    state.patients = state.patients.filter(item => item.id !== patient.id);
    await persist();
    renderHome();
    if (currentPatientId === patient.id) {
      currentPatientId = null;
      showScreen("home");
    }
    showToast("Registro excluído definitivamente.");
  }

  function createPatient(bed) {
    showModal(`Cadastrar paciente — leito ${bed}`, `
      <label>Identificação curta (opcional)<input name="label" maxlength="80" placeholder="Iniciais ou referência pessoal"></label>
      <label>Data de internação<input name="admissionDate" type="date" value="${localISO()}" required></label>
      <p class="form-hint">A data será usada para calcular o DIH de cada evolução. Ela poderá ser corrigida depois.</p>`, async data => {
      const admissionDate = data.get("admissionDate");
      if (!parseISO(admissionDate)) throw new Error("Informe uma data de internação válida.");
      const patient = {
        id: uid(), bed, label: String(data.get("label") || "").trim(), admissionDate,
        status: "active", evolutions: [], pendings: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      state.patients.push(patient);
      await persist();
      closeModal();
      renderHome();
      openPatient(patient.id);
    });
  }

  function renderPatient(patient) {
    const todayDay = dayNumber(patient.admissionDate);
    $("#patientTitle").textContent = `Leito ${patient.bed}`;
    $("#patientLabel").textContent = patient.label || "Paciente";
    $("#patientMeta").textContent = `Internação em ${fmtDate(patient.admissionDate)} · ${todayDay && todayDay > 0 ? `D${todayDay}` : "Conferir data de internação"}`;
    $("#patientStatus").textContent = patient.status === "archived" ? `Alta em ${fmtDate(patient.dischargedAt)}` : "Internado";
    renderAntibiotics(patient);
    $("#dischargeButton").hidden = patient.status === "archived";
    $("#reactivateButton").hidden = patient.status !== "archived";

    const evolutionList = $("#evolutionList");
    const evolutions = [...patient.evolutions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    $("#evolutionCount").textContent = `${evolutions.length} ${evolutions.length === 1 ? "registro" : "registros"}`;
    evolutionList.innerHTML = evolutions.length ? evolutions.map(evolution => {
      const d = dayNumber(patient.admissionDate, evolution.date);
      const preview = String(evolution.text || "").replace(/\s+/g, " ").trim().slice(0, 170);
      return `<button type="button" class="evolution-item" data-evolution-id="${escapeHTML(evolution.id)}">
        <span class="evolution-date">${fmtDate(evolution.date)} <span>${d && d > 0 ? `D${d}` : "DIH a conferir"}</span></span>
        <span class="evolution-preview">${escapeHTML(preview || "Evolução sem texto")}</span>
        <span class="evolution-edit">Abrir e editar ›</span>
      </button>`;
    }).join("") : `<div class="empty-state">Nenhuma evolução salva para este paciente.<br>Use “Nova evolução” para começar.</div>`;
    evolutionList.querySelectorAll("[data-evolution-id]").forEach(button => button.addEventListener("click", () => {
      const evolution = patient.evolutions.find(item => item.id === button.dataset.evolutionId);
      if (evolution) editEvolution(patient, evolution);
    }));

    renderPendings(patient);
    $("#patientScreen").dataset.patientId = patient.id;
  }

  function renderPendings(patient) {
    const list = $("#patientPendingList");
    const openCount = patient.pendings.filter(item => !item.done).length;
    $("#pendingCount").textContent = `${openCount} aberta(s)`;
    const pendings = [...patient.pendings].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));
    list.innerHTML = pendings.length ? pendings.map(item => `
      <div class="long-pending ${item.done ? "done" : ""}" data-pending-id="${escapeHTML(item.id)}">
        <label><input type="checkbox" ${item.done ? "checked" : ""} aria-label="Concluir pendência"><span>${escapeHTML(item.text)}</span></label>
        ${item.done ? `<small>Concluída em ${fmtDate(item.completedAt)}</small>` : ""}
        <button type="button" class="remove-pending" aria-label="Remover pendência">×</button>
      </div>`).join("") : `<p class="muted-empty">Nenhuma pendência cadastrada.</p>`;
    list.querySelectorAll(".long-pending").forEach(row => {
      const item = patient.pendings.find(pending => pending.id === row.dataset.pendingId);
      row.querySelector("input[type=checkbox]").addEventListener("change", async event => {
        item.done = event.target.checked;
        item.completedAt = item.done ? localISO() : null;
        patient.updatedAt = new Date().toISOString();
        await persist();
        renderPatient(patient);
        renderHome();
      });
      row.querySelector(".remove-pending").addEventListener("click", async () => {
        if (!confirm("Remover esta pendência do acompanhamento?")) return;
        patient.pendings = patient.pendings.filter(pending => pending.id !== item.id);
        await persist();
        renderPatient(patient);
        renderHome();
      });
    });
  }

  function openPatient(id) {
    const patient = getPatient(id);
    if (!patient) return;
    currentPatientId = patient.id;
    ["#antibioticSection", "#evolutionSection", ".pending-collapsible"].forEach(selector => {
      const section = $(selector);
      if (section) section.open = false;
    });
    renderPatient(patient);
    showScreen("patient");
  }

  function editPatient(patient) {
    const options = state.beds.map(bed => `<option value="${escapeHTML(bed)}" ${bed === patient.bed ? "selected" : ""}>${escapeHTML(bed)}</option>`).join("");
    showModal("Editar dados do paciente", `
      <label>Identificação curta<input name="label" maxlength="80" value="${escapeHTML(patient.label || "")}" placeholder="Iniciais ou referência pessoal"></label>
      <label>Leito<select name="bed">${options}</select></label>
      <label>Data de internação<input name="admissionDate" type="date" value="${escapeHTML(patient.admissionDate)}" required></label>
      <p class="form-hint">Ao corrigir a internação, o DIH de todas as evoluções será recalculado. As datas e os textos das evoluções não serão alterados.</p>`, async data => {
      const admissionDate = data.get("admissionDate");
      if (!parseISO(admissionDate)) throw new Error("Informe uma data de internação válida.");
      const newBed = String(data.get("bed"));
      const occupied = activePatients().some(item => item.id !== patient.id && item.bed === newBed);
      if (occupied) throw new Error("Este leito já está ocupado.");
      patient.label = String(data.get("label") || "").trim();
      patient.bed = newBed;
      patient.admissionDate = admissionDate;
      patient.updatedAt = new Date().toISOString();
      await persist();
      closeModal();
      renderPatient(patient);
      renderHome();
      showToast("Dados do paciente atualizados.");
    });
  }

  function editEvolution(patient, evolution) {
    showModal("Visualizar / editar evolução", `
      <label>Data da evolução<input name="date" type="date" value="${escapeHTML(evolution.date)}" required></label>
      <label>Texto da evolução<textarea name="text" class="evolution-editor" rows="16" required>${escapeHTML(evolution.text)}</textarea></label>
      <p class="form-hint">A edição altera apenas esta evolução. O D exibido no histórico é recalculado pela data de internação e pela data desta evolução.</p>
      <button type="button" class="text-danger" id="deleteEvolutionButton">Excluir esta evolução</button>`, async data => {
      const date = data.get("date");
      const text = String(data.get("text") || "").trim();
      if (!parseISO(date)) throw new Error("Informe uma data válida.");
      if (!text) throw new Error("O texto da evolução não pode ficar vazio.");
      evolution.date = date;
      evolution.text = text;
      evolution.updatedAt = new Date().toISOString();
      patient.updatedAt = new Date().toISOString();
      await persist();
      closeModal();
      renderPatient(patient);
      showToast("Evolução atualizada.");
    }, "Salvar alterações");
    const deleteButton = document.querySelector("#deleteEvolutionButton");
    deleteButton?.addEventListener("click", async () => {
      if (!confirm("Excluir definitivamente esta evolução?")) return;
      patient.evolutions = patient.evolutions.filter(item => item.id !== evolution.id);
      await persist();
      closeModal();
      renderPatient(patient);
      showToast("Evolução excluída.");
    });
  }

  function addLongPending(patient) {
    showModal("Adicionar pendência", `
      <label>Descrição<input name="text" maxlength="240" placeholder="Ex.: Aguardar resultado da hemocultura" required></label>`, async data => {
      const text = String(data.get("text") || "").trim();
      if (!text) throw new Error("Descreva a pendência.");
      const duplicate = patient.pendings.some(item => !item.done && item.text.toLowerCase() === text.toLowerCase());
      if (!duplicate) patient.pendings.push({ id: uid(), text, done: false, createdAt: new Date().toISOString(), completedAt: null });
      patient.updatedAt = new Date().toISOString();
      await persist();
      closeModal();
      renderPatient(patient);
      renderHome();
    });
  }

  async function dischargePatient(patient) {
    if (!confirm(`Registrar alta e liberar o leito ${patient.bed}? O histórico será preservado.`)) return;
    patient.status = "archived";
    patient.dischargedAt = localISO();
    patient.updatedAt = new Date().toISOString();
    await persist();
    currentPatientId = null;
    renderHome();
    showScreen("home");
  }

  async function reactivatePatient(patient) {
    const occupied = activePatients().some(item => item.id !== patient.id && item.bed === patient.bed);
    if (occupied) {
      showToast("O leito original está ocupado. Edite os dados para escolher outro leito antes de reativar.");
      editPatient(patient);
      return;
    }
    patient.status = "active";
    patient.dischargedAt = null;
    patient.updatedAt = new Date().toISOString();
    await persist();
    renderPatient(patient);
    renderHome();
  }

  function clearGenerator() {
    $("#clearButton").click();
    const saveButton = $("#saveToPatientButton");
    if (saveButton) saveButton.disabled = true;
  }

  function openGenerator(patientId = null) {
    currentPatientId = patientId;
    clearGenerator();
    const patient = patientId ? getPatient(patientId) : null;
    if (patient) {
    }
    const antibioticDate = $("#abxStartDate");
    if (antibioticDate) antibioticDate.value = localISO();
    $("#generatorContext").textContent = patient ? `Evolução destinada ao leito ${patient.bed}` : "Gerador independente — escolha o paciente ao salvar";
    showScreen("generator");
  }

  function addSaveButton() {
    // There are two .result-header elements: one in the patient history and
    // another in the generator. Target the generator explicitly so the action
    // is visible next to the generated text's Copy button.
    const header = $("#generatorScreen .result-section .result-header");
    const originalCopy = $("#copyButton");
    if (!header || !originalCopy || $("#saveToPatientButton")) return;

    // Keep both result actions grouped without changing the original form HTML.
    const actions = document.createElement("div");
    actions.className = "result-actions";
    originalCopy.parentNode.insertBefore(actions, originalCopy);
    actions.append(originalCopy);

    const button = document.createElement("button");
    button.id = "saveToPatientButton";
    button.className = "primary";
    button.type = "button";
    button.textContent = "Salvar em...";
    button.disabled = true;
    button.addEventListener("click", saveOutput);
    actions.append(button);

    const syncButton = () => { button.disabled = !$("#output").value.trim(); };
    $("#output").addEventListener("input", syncButton);
    $("#clearButton").addEventListener("click", () => { button.disabled = true; });
    originalCopy.addEventListener("click", syncButton);
    $("#noteForm").addEventListener("submit", () => { setTimeout(syncButton, 0); });
  }

  function formPendingTexts() {
    return [...document.querySelectorAll("#pendingItems .pending-row input[type=text]")]
      .map(input => input.value.trim()).filter(Boolean);
  }

  function saveOutput() {
    const text = $("#output").value.trim();
    if (!text) {
      showToast("Gere a evolução antes de salvar.");
      return;
    }
    const choices = activePatients();
    if (!choices.length) {
      showToast("Cadastre um paciente na tela inicial antes de salvar.");
      return;
    }
    const current = getPatient(currentPatientId);
    const selectOptions = choices.map(patient => `<option value="${escapeHTML(patient.id)}" ${current?.id === patient.id ? "selected" : ""}>Leito ${escapeHTML(patient.bed)}${patient.label ? ` — ${escapeHTML(patient.label)}` : ""}</option>`).join("");
    showModal("Salvar evolução em", `
      <label>Paciente de destino<select name="patientId" required>${selectOptions}</select></label>
      <label>Data da evolução<input name="date" type="date" value="${localISO()}" required></label>
      <p class="form-hint">As pendências digitadas no formulário também serão adicionadas à lista longitudinal do paciente, sem duplicar pendências abertas com o mesmo texto.</p>`, async data => {
      const patient = getPatient(String(data.get("patientId")));
      if (!patient || patient.status === "archived") throw new Error("Selecione um paciente ativo.");
      const date = String(data.get("date") || "");
      if (!parseISO(date)) throw new Error("Informe uma data válida para a evolução.");
      const now = new Date().toISOString();
      const evolution = { id: uid(), date, text, createdAt: now, updatedAt: now };
      patient.evolutions.push(evolution);
      formPendingTexts().forEach(pendingText => {
        const duplicate = patient.pendings.some(item => !item.done && item.text.toLocaleLowerCase("pt-BR") === pendingText.toLocaleLowerCase("pt-BR"));
        if (!duplicate) patient.pendings.push({ id: uid(), text: pendingText, done: false, createdAt: now, completedAt: null });
      });
      patient.updatedAt = now;
      await persist();
      closeModal();
      currentPatientId = patient.id;
      renderHome();
      openPatient(patient.id);
      showToast("Evolução salva no paciente.");
    });
  }

  function addBed() {
    showModal("Adicionar leito", `
      <label>Número / identificação do leito<input name="bed" maxlength="24" placeholder="Ex.: 104" required></label>`, async data => {
      const bed = String(data.get("bed") || "").trim();
      if (!bed) throw new Error("Informe a identificação do leito.");
      if (state.beds.some(item => item.toLowerCase() === bed.toLowerCase())) throw new Error("Este leito já está cadastrado.");
      state.beds.push(bed);
      await persist();
      closeModal();
      renderHome();
    });
  }

  function backup() {
    const payload = makeBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `backup-minha-enfermaria-${localISO()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Backup exportado.");
  }

  function restore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(String(reader.result || ""));
        if (payload.app !== "Minha Enfermaria" || !Array.isArray(payload.state?.beds) || !Array.isArray(payload.state?.patients)) {
          throw new Error("Arquivo não reconhecido como backup desta aplicação.");
        }
        const validPatients = payload.state.patients.every(patient => patient.id && patient.bed && parseISO(patient.admissionDate) && Array.isArray(patient.evolutions) && Array.isArray(patient.pendings));
        if (!validPatients) throw new Error("O backup contém registros incompletos ou inválidos.");
        if (!confirm("A restauração substituirá os dados atualmente salvos neste dispositivo. Faça um backup antes de continuar. Deseja prosseguir?")) return;
        state = { beds: [...new Set(payload.state.beds.map(String))], patients: payload.state.patients };
        await persist();
        currentPatientId = null;
        renderHome();
        showScreen("home");
        showToast("Backup restaurado.");
      } catch (error) {
        showToast(error.message || "Não foi possível restaurar o backup.");
      } finally {
        $("#restoreInput").value = "";
      }
    };
    reader.onerror = () => showToast("Falha ao ler o arquivo de backup.");
    reader.readAsText(file);
  }

  function renderAntibiotics(patient) {
    if (!Array.isArray(patient.antibiotics)) patient.antibiotics = [];
    const list = $("#patientAntibioticList");
    const summary = $("#antibioticSummary");
    if (!list || !summary) return;

    const active = patient.antibiotics.filter(item => item.status === "active");
    const history = patient.antibiotics.filter(item => item.status !== "active");

    const treatmentDay = item => {
      const day = dayNumber(item.startDate);
      return day && day > 0 ? `D${day}` : `início em ${fmtDate(item.startDate)}`;
    };

    const activeSummary = active.map(item =>
      `${item.name} — Em uso · iniciado em ${fmtDate(item.startDate)} · ${treatmentDay(item)}`
    );

    summary.textContent = activeSummary.length
      ? activeSummary.join(" | ")
      : "Nenhum antibiótico em uso";
    summary.title = summary.textContent;

    const card = item => `
      <div class="antibiotic-item">
        <div>
          <strong>${escapeHTML(item.name)}</strong>
          <p>
            ${item.status === "active"
              ? `Em uso · iniciado em ${fmtDate(item.startDate)} · ${treatmentDay(item)}`
              : `${item.status === "suspended" ? "Suspenso" : "Finalizado"} em ${fmtDate(item.endDate)} · iniciado em ${fmtDate(item.startDate)}`
            }
          </p>
        </div>
        ${item.status === "active"
          ? `<div class="antibiotic-actions">
              <button class="small secondary" type="button" data-abx-end="${escapeHTML(item.id)}" data-status="completed">Finalizar</button>
              <button class="small secondary" type="button" data-abx-end="${escapeHTML(item.id)}" data-status="suspended">Suspender</button>
            </div>`
          : `<span class="abx-status">${item.status === "suspended" ? "Suspenso" : "Finalizado"}</span>`
        }
      </div>
    `;

    list.innerHTML = active.length || history.length
      ? `
        ${active.length
          ? active.map(card).join("")
          : `<p class="muted-empty">Nenhum antibiótico em uso.</p>`
        }
        ${history.length
          ? `<details class="antibiotic-history">
              <summary>Histórico (${history.length})</summary>
              ${[...history]
                .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""))
                .map(card).join("")}
            </details>`
          : ""
        }
      `
      : `<p class="muted-empty">Nenhuma antibioticoterapia registrada.</p>`;

    list.querySelectorAll("[data-abx-end]").forEach(button => {
      button.addEventListener("click", () =>
        endAntibiotic(patient, button.dataset.abxEnd, button.dataset.status)
      );
    });
  }

  function addPatientAntibiotic(patient) {
    showModal("Adicionar antibioticoterapia", `
      <label>Antibiótico padronizado<select name="standard"><option value="">Selecione...</option>${ANTIBIOTICS.map(item => `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join("")}</select></label>
      <label>Ou antibiótico não padronizado<input name="custom" maxlength="100" placeholder="Digite o nome, se não estiver na lista"></label>
      <label>Data de início<input name="startDate" type="date" value="${localISO()}" required></label>
      <p class="form-hint">Se preencher o campo não padronizado, ele terá prioridade sobre a seleção acima.</p>`, async data => {
      const name = String(data.get("custom") || "").trim() || String(data.get("standard") || "").trim();
      const startDate = String(data.get("startDate") || "");
      if (!name) throw new Error("Selecione ou informe o antibiótico.");
      if (!parseISO(startDate)) throw new Error("Informe uma data de início válida.");
      if (!Array.isArray(patient.antibiotics)) patient.antibiotics = [];
      patient.antibiotics.push({ id: uid(), name, startDate, endDate: null, status: "active", createdAt: new Date().toISOString() });
      patient.updatedAt = new Date().toISOString();
      await persist();
      closeModal();
      renderPatient(patient);
      renderHome();
      showToast(`${name} registrado.`);
    });
  }

  async function endAntibiotic(patient, id, status) {
    const item = (patient.antibiotics || []).find(entry => entry.id === id);
    if (!item || item.status !== "active") return;

    const label = status === "suspended" ? "suspenso" : "finalizado";
    if (!confirm(`Confirmar ${label} ${item.name}? A data de hoje será registrada no histórico de antibioticoterapia.`)) return;

    const today = localISO();
    item.status = status;
    item.endDate = today;
    item.updatedAt = new Date().toISOString();
    patient.updatedAt = item.updatedAt;

    await persist();
    renderPatient(patient);
    renderHome();
    showToast(`${item.name}: ${label} e registrado no histórico.`);
  }

  function bindAntibioticControls() {
    $("#addPatientAntibioticButton")?.addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient?.status === "active") addPatientAntibiotic(patient);
      else showToast("Antibioticoterapia só pode ser alterada em internação ativa.");
    });
  }

  function bindEvents() {
    $("#addBedButton").addEventListener("click", addBed);
    $("#openGeneratorButton").addEventListener("click", () => openGenerator(null));
    $("#generatorBackButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient) openPatient(patient.id);
      else {
        currentPatientId = null;
        renderHome();
        showScreen("home");
      }
    });
    $("#patientBackButton").addEventListener("click", () => {
      currentPatientId = null;
      renderHome();
      showScreen("home");
    });
    $("#newEvolutionButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient?.status === "active") openGenerator(patient.id);
      else showToast("Este paciente está arquivado. Reative-o para registrar uma nova evolução.");
    });
    $("#editPatientButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient) editPatient(patient);
    });
    $("#dischargeButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient) dischargePatient(patient);
    });
    $("#reactivateButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient) reactivatePatient(patient);
    });
    $("#addPatientPendingButton").addEventListener("click", () => {
      const patient = getPatient(currentPatientId);
      if (patient) addLongPending(patient);
    });

    bindAntibioticControls();

    $("#backupButton").addEventListener("click", backup);
    $("#configureExternalBackupButton").addEventListener("click", manageExternalBackup);
    $("#changeExternalBackupButton").addEventListener("click", changeExternalBackupFile);
    $("#protectStorageButton").addEventListener("click", protectLocalStorage);
    $("#restoreButton").addEventListener("click", () => $("#restoreInput").click());
    $("#restoreInput").addEventListener("change", event => restore(event.target.files?.[0]));
  }

  async function init() {
    try {
      db = await openDatabase();
      const saved = await readState();
      if (saved && Array.isArray(saved.beds) && Array.isArray(saved.patients)) state = saved;
      await loadExternalBackupHandle();
      await refreshStorageProtection(true);
      if (!saved) await persist();
      bindEvents();
      addSaveButton();
      updateExternalBackupUI();
      renderHome();
      showScreen("home");
      if (location.protocol === "file:") {
        $("#storageNotice").textContent = "Arquivo local: armazenamento e acesso a arquivos dependem do navegador. Use o site HTTPS instalado como PWA.";
      }
    } catch (error) {
      $("#managerHome").innerHTML = `<div class="manager-warning"><strong>Armazenamento local indisponível.</strong><p>${escapeHTML(error.message)}</p><p>Não utilize o aplicativo para registrar dados enquanto o armazenamento persistente não estiver funcionando.</p></div>`;
      showScreen("home");
    }
  }

  init();
})();
