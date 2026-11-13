
"use strict";

const examSystems = [
  {
    id: "geral", title: "Estado geral", fields: [
      { id: "estado", label: "Estado geral", type: "radio", options: ["BEG", "REG", "MEG"] },
      { id: "consciencia", label: "Consciência e orientação", type: "radio", options: ["Lúcido e orientado", "Desorientado", "Sonolento", "Torporoso", "Comatoso", "Agitado"] },
      { id: "coloracao", label: "Coloração", type: "radio", options: ["Corado", "Hipocorado"] },
      { id: "ictericia", label: "Icterícia", type: "radio", options: ["Anictérico", "Ictérico"] },
      { id: "cianose", label: "Cianose", type: "radio", options: ["Acianótico", "Cianótico"] },
      { id: "hidratacao", label: "Hidratação", type: "radio", options: ["Hidratado", "Desidratado"] },
      { id: "perfusao", label: "Perfusão", type: "radio", options: ["Perfusão periférica preservada", "TEC lentificado"] }
    ]
  },
  {
    id: "neurologico", title: "Neurológico", fields: [
      { id: "glasgow", label: "Escala de Coma de Glasgow", type: "number", placeholder: "3–15", min: 3, max: 15 },
      { id: "pupilas", label: "Pupilas", type: "radio", options: ["Isocóricas e fotorreagentes", "Anisocóricas", "Não fotorreagentes"] },
      { id: "focal", label: "Déficits focais", type: "radio", options: ["Sem déficits focais", "Déficit motor", "Déficit sensitivo", "Paresia", "Plegia"] },
      { id: "outros", label: "Outros achados", type: "checks", options: ["Sem rigidez de nuca", "Rigidez de nuca", "Tremores", "Convulsões", "Alteração de comportamento"] }
    ]
  },
  {
    id: "cardiovascular", title: "Cardiovascular", fields: [
      { id: "ritmo", label: "Ritmo", type: "radio", options: ["Ritmo cardíaco regular", "Ritmo cardíaco irregular"] },
      { id: "bulhas", label: "Bulhas", type: "radio", options: ["Bulhas normofonéticas", "Bulhas hipofonéticas"] },
      { id: "sopros", label: "Sopros", type: "radio", options: ["Sem sopros", "Com sopro"] },
      { id: "adicionais", label: "Achados adicionais", type: "checks", options: ["B3", "B4", "Turgência jugular", "Pulsos periféricos palpáveis", "Pulsos assimétricos", "Perfusão periférica reduzida"] }
    ]
  },
  {
    id: "respiratorio", title: "Respiratório", fields: [
      { id: "suporte", label: "Suporte ventilatório", type: "radio", options: ["Respirando em ar ambiente", "Cateter nasal de O₂", "Máscara de oxigênio", "Ventilação não invasiva", "Ventilação mecânica"] },
      { id: "padrao", label: "Padrão respiratório", type: "radio", options: ["Eupneico", "Taquipneico", "Bradipneico"] },
      { id: "esforco", label: "Esforço respiratório", type: "radio", options: ["Sem esforço respiratório", "Uso de musculatura acessória", "Tiragem", "Batimento de asa nasal"] },
      { id: "ausculta", label: "Ausculta pulmonar", type: "radio", options: ["MVUA, sem ruídos adventícios", "Murmúrio vesicular diminuído"] },
      { id: "adventicios", label: "Ruídos adventícios", type: "checks", options: ["Estertores crepitantes", "Sibilos", "Roncos", "Atrito pleural"] },
      { id: "outros", label: "Outros achados", type: "checks", options: ["Expansibilidade preservada", "Expansibilidade reduzida", "Assimetria à ausculta"] }
    ]
  },
  {
    id: "abdome", title: "Abdome", fields: [
      { id: "inspecao", label: "Inspeção", type: "checks", options: ["Plano", "Globoso", "Distendido", "Escavado", "Ascite"] },
      { id: "rha", label: "Ruídos hidroaéreos", type: "radio", options: ["RHA presentes", "RHA diminuídos", "RHA aumentados", "RHA ausentes"] },
      { id: "palpacao", label: "Palpação", type: "checks", options: ["Flácido", "Indolor à palpação", "Dor à palpação", "Defesa abdominal", "Descompressão brusca positiva", "Massas palpáveis", "Visceromegalias"] },
      { id: "especificos", label: "Sinais específicos", type: "checks", options: ["Murphy positivo", "Blumberg positivo", "Giordano positivo"] }
    ]
  },
  {
    id: "geniturinario", title: "Geniturinário", fields: [
      { id: "dispositivos", label: "Dispositivo vesical", type: "radio", options: ["Sem dispositivo vesical", "Sonda vesical de demora", "Cistostomia"] },
      { id: "achados", label: "Achados", type: "checks", options: ["Diurese espontânea", "Oligúria", "Anúria", "Hematúria", "Disúria", "Globo vesical"] }
    ]
  },
  {
    id: "extremidades", title: "Extremidades e vascular", fields: [
      { id: "edema", label: "Edema", type: "radio", options: ["Sem edema", "Edema +/4+", "Edema ++/4+", "Edema +++/4+", "Edema ++++/4+"] },
      { id: "vascular", label: "Avaliação vascular", type: "checks", options: ["Pulsos periféricos palpáveis", "Pulsos diminuídos", "Assimetria de pulsos", "Panturrilhas livres", "Empastamento de panturrilhas", "Sinais clínicos de TVP"] },
      { id: "outros", label: "Outros achados", type: "checks", options: ["Extremidades aquecidas", "Extremidades frias", "Deformidades articulares"] }
    ]
  },
  {
    id: "pele", title: "Pele e dispositivos", fields: [
      { id: "pele", label: "Pele e tegumento", type: "radio", options: ["Sem lesões cutâneas", "Com lesões cutâneas"] },
      { id: "lesoes", label: "Tipo de lesão", type: "checks", options: ["Equimoses", "Petéquias", "Úlcera por pressão", "Ferida operatória", "Hiperemia"] },
      { id: "dispositivos", label: "Dispositivos", type: "checks", options: ["Acesso venoso periférico", "Cateter venoso central", "PICC", "Sonda nasoenteral", "Dreno", "Traqueostomia"] }
    ]
  }
];

const labFields = [
  ["hb", "Hb"], ["leuco", "Leuco"], ["leucoDif", "Diferencial", "wide"], ["plaq", "Plaq."], ["ca", "Ca total"], ["mg", "Mg"], ["na", "Na"],
  ["k", "K"], ["pcr", "PCR"], ["cr", "Cr"], ["ur", "Ur"], ["inr", "INR"],
  ["tgo", "TGO"], ["tgp", "TGP"], ["fa", "FA"], ["ggt", "GGT"], ["alb", "Albumina"], ["bi", "BI"], ["bt", "BT"],
  ["lactato", "Lactato"], ["ph", "pH"], ["po2", "PO2"], ["pco2", "PCO2"], ["hco3", "HCO3"]
];

const form = document.querySelector("#noteForm");
const output = document.querySelector("#output");
const pendingItems = document.querySelector("#pendingItems");

const value = name => {
  const field = form.elements.namedItem(name);
  return field && typeof field.value === "string" ? field.value.trim() : "";
};

const textLine = (label, name) => value(name) ? `${label}: ${value(name)}` : "";

const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[char]);

function renderExamOptions() {
  const container = document.querySelector("#examGroups");

  container.innerHTML = examSystems.map(system => `
    <details class="exam-system" data-system="${system.id}">
      <summary>
        <span class="exam-system-title">${system.title}</span>
        <span class="exam-system-count" aria-live="polite">0 selecionados</span>
      </summary>

      <div class="exam-system-content">
        ${system.fields.map(field => {
          if (field.type === "number") {
            return `
              <div class="exam-field">
                <span class="exam-field-title">${field.label}</span>
                <input
                  class="exam-number"
                  type="number"
                  name="exam_${system.id}_${field.id}"
                  min="${field.min}"
                  max="${field.max}"
                  placeholder="${field.placeholder}"
                  inputmode="numeric">
              </div>`;
          }

          const type = field.type === "radio" ? "radio" : "checkbox";

          return `
            <div class="exam-field">
              <span class="exam-field-title">${field.label}</span>
              <div class="exam-choices">
                ${field.options.map(option => `
                  <label class="exam-choice">
                    <input
                      type="${type}"
                      name="exam_${system.id}_${field.id}"
                      value="${escapeHTML(option)}">
                    <span>${escapeHTML(option)}</span>
                  </label>
                `).join("")}
              </div>
            </div>`;
        }).join("")}

        <label class="exam-observation">
          Observações do sistema
          <textarea
            name="exam_obs_${system.id}"
            rows="2"
            placeholder="Outros achados relevantes..."></textarea>
        </label>

        <div class="exam-system-footer">
          <button type="button" class="exam-clear secondary small" data-clear-system="${system.id}">
            Limpar sistema
          </button>
        </div>
      </div>
    </details>
  `).join("");

  container.querySelectorAll(".exam-system").forEach(systemElement => {
    systemElement.addEventListener("change", () => updateExamCount(systemElement));
    systemElement.addEventListener("input", () => updateExamCount(systemElement));

    systemElement.querySelector("[data-clear-system]").addEventListener("click", () => {
      systemElement.querySelectorAll('input[type="checkbox"], input[type="radio"]')
        .forEach(input => input.checked = false);

      systemElement.querySelectorAll('input[type="number"], textarea')
        .forEach(input => input.value = "");

      updateExamCount(systemElement);
    });

    updateExamCount(systemElement);
  });
}

function updateExamCount(systemElement) {
  const selected = systemElement.querySelectorAll(
    'input[type="checkbox"]:checked, input[type="radio"]:checked'
  ).length;

  const filled = [...systemElement.querySelectorAll('input[type="number"], textarea')]
    .filter(input => input.value.trim()).length;

  const count = selected + filled;

  systemElement.querySelector(".exam-system-count").textContent =
    `${count} ${count === 1 ? "selecionado" : "selecionados"}`;
}

function collectExamFindings() {
  return examSystems.map(system => {
    const systemElement = document.querySelector(`[data-system="${system.id}"]`);
    const findings = [];

    system.fields.forEach(field => {
      if (field.type === "number") {
        const input = systemElement.querySelector(
          `[name="exam_${system.id}_${field.id}"]`
        );

        if (input?.value.trim()) {
          findings.push(`Glasgow ${input.value.trim()}`);
        }
        return;
      }

      const selected = [
        ...systemElement.querySelectorAll(
          `[name="exam_${system.id}_${field.id}"]:checked`
        )
      ].map(input => input.value);

      findings.push(...selected);
    });

    const observations = systemElement
      .querySelector(`[name="exam_obs_${system.id}"]`)
      ?.value.trim();

    if (observations) {
      findings.push(`Observações: ${observations}`);
    }

    return findings.length
      ? `${system.title}: ${findings.join("; ")}`
      : "";
  }).filter(Boolean);
}

function renderLabFields() {
  document.querySelector("#labGrid").innerHTML = labFields.map(([key, label, cls]) =>
    `<label class="${cls || ""}">${label}<input type="text" name="lab_${key}" autocomplete="off"${key === "leucoDif" ? ' placeholder="Ex.: 2% bast / 70% seg"' : ""}></label>`
  ).join("");
}

function labsLine() {
  const get = key => value(`lab_${key}`);
  const parts = [];

  labFields.forEach(([key, label]) => {
    if (key === "leucoDif") return;

    if (key === "leuco") {
      if (get("leuco") && get("leucoDif")) {
        parts.push(`Leuco ${get("leuco")} (${get("leucoDif")})`);
      } else if (get("leuco")) {
        parts.push(`Leuco ${get("leuco")}`);
      } else if (get("leucoDif")) {
        parts.push(`Leuco (${get("leucoDif")})`);
      }
    } else if (get(key)) {
      parts.push(`${label} ${get(key)}`);
    }
  });

  value("labOutros").split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .forEach(item => parts.push(item));

  return parts.length ? `Laboratoriais: ${parts.join(" / ")}` : "";
}

function addPending(text = "") {
  const row = document.createElement("div");
  row.className = "pending-row";

  row.innerHTML = `
    <input
      type="text"
      aria-label="Descrição da pendência"
      placeholder="Descrever pendência"
      value="${escapeHTML(text)}">
    <button class="remove" type="button" aria-label="Remover pendência">×</button>
  `;

  row.querySelector(".remove").addEventListener("click", () => row.remove());
  pendingItems.append(row);
}

function rangeLine(label, unit, maxName, minName) {
  const max = value(maxName);
  const min = value(minName);

  if (!max && !min) return "";

  const parts = [];
  if (min) parts.push(min);
  if (max) parts.push(max);

  return `${label}: ${parts.join("-")}${unit || ""}`;
}

function section(title, lines) {
  const entries = lines.filter(Boolean);
  return entries.length ? `${title}\n${entries.join("\n")}` : "";
}

function bulletList(label, name) {
  const entries = value(name).split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

  return entries.length
    ? `${label}\n${entries.map(item => `- ${item.replace(/^-\s*/, "")}`).join("\n")}`
    : "";
}

function generateNote() {
  const header = [
    bulletList("# Diagnóstico(s)", "diagnosticos"),
    textLine("# Alergias", "alergias"),
    textLine("# HPP", "hpp"),
    textLine("# Medicações de uso contínuo", "medicacoesUso"),
    value("hda") ? `HDA:\n${value("hda")}` : ""
  ].filter(Boolean).join("\n");

  const vitals = [
    rangeLine("PAS", "mmHg", "pasMax", "pasMin"),
    rangeLine("PAD", "mmHg", "padMax", "padMin"),
    rangeLine("FC", "bpm", "fcMax", "fcMin"),
    rangeLine("SpO₂", "%", "spo2Max", "spo2Min"),
    rangeLine("Temp", "°C", "tempMax", "tempMin")
  ];

  const last24 = section("ÚLTIMAS 24 HORAS", [
    ...vitals,
    textLine("Débito urinário", "debitoUrinario"),
    textLine("Drenos", "drenos"),
    textLine("Outros débitos", "outrosDebitos"),
    textLine("Intercorrências", "intercorrencias"),
    textLine("Queixas / evolução subjetiva", "subjetivo")
  ]);

  const exam = section("EXAME FÍSICO", collectExamFindings());

  const complementary = section("EXAMES COMPLEMENTARES", [
    labsLine(),
    textLine("Imagem", "imagem")
  ]);

  const impression = section("IMPRESSÃO", [value("impressao")]);

  const pending = [...pendingItems.querySelectorAll(".pending-row")]
    .map(row => row.querySelector('input[type="text"]').value.trim())
    .filter(Boolean);

  const pendingSection = section(
    "PENDÊNCIAS",
    pending.map(item => `- [ ] ${item}`)
  );

  output.value = [
    header,
    last24,
    exam,
    complementary,
    impression,
    pendingSection
  ].filter(Boolean).join("\n\n");

  const hasOutput = Boolean(output.value.trim());
  document.querySelector("#copyButton").disabled = !hasOutput;

  return hasOutput;
}

renderExamOptions();
renderLabFields();
addPending();

document.querySelector("#addPending").addEventListener("click", () => addPending());

form.addEventListener("submit", event => {
  event.preventDefault();

  const generated = generateNote();

  if (!generated) {
    window.alert("Preencha pelo menos um campo antes de gerar a evolução.");
    return;
  }

  output.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#clearButton").addEventListener("click", () => {
  form.reset();
  pendingItems.replaceChildren();
  addPending();
  output.value = "";
  document.querySelector("#copyButton").disabled = true;

  document.querySelectorAll(".exam-system").forEach(updateExamCount);
});

document.querySelector("#copyButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    output.focus();
    output.select();
    document.execCommand("copy");
  }

  const button = document.querySelector("#copyButton");
  const original = button.textContent;
  button.textContent = "Copiado";

  setTimeout(() => button.textContent = original, 1600);
});

let installPrompt;

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  document.querySelector("#installButton").classList.remove("hidden");
});

document.querySelector("#installButton").addEventListener("click", async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./service-worker.js")
  );
}
