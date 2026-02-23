/**
 * FLUXHOOK
 * 
 * Aplicativo para criar e enviar webhooks com embeds personalizados
 * 
 * ORGANIZAÇÃO DO CÓDIGO:
 * - Configurações (linhas ~1-15)
 * - Estado Global e Referências DOM (linhas ~16-25)
 * - Event Listeners Principais (linhas ~26-105)
 * - Funções de Embeds (linhas ~106-900)
 * - Funções de Preview (linhas ~900-1250)
 * - Funções de Payload e Envio (linhas ~1250-1280)
 * - Modo Múltiplas Mensagens (linhas ~1280-1750)
 * - Funções de Importação/Exportação (linhas ~1750-1850)
 * - Inicialização (linhas ~1850+)
 * 
 * FUNCIONALIDADES:
 * ✓ Criação de embeds com drag-and-drop
 * ✓ Preview em tempo real
 * ✓ Modo múltiplas mensagens (pode ser desabilitado na configuração)
 * ✓ Importar/Exportar JSON
 * ✓ Temas claro/escuro
 */

// ========== CONFIGURAÇÕES ==========
/**
 * ENABLE_MULTI_MESSAGE_MODE
 * 
 * Define se o modo múltiplas mensagens estará disponível no aplicativo.
 * 
 * - true:  Habilita o botão "Modo Múltiplo" e todas as funcionalidades de grupo de mensagens
 * - false: Desabilita completamente o modo múltiplas mensagens
 *          O botão será ocultado e as funções não serão inicializadas
 * 
 * Para desativar permanentemente, altere para: const ENABLE_MULTI_MESSAGE_MODE = false;
 */
const ENABLE_MULTI_MESSAGE_MODE = true;
// ====================================

// Helper para traduções (shorthand)
const t = (key, vars) => i18n ? i18n.t(key, vars) : key;

// Estado global dos embeds
let embeds = [];

// Sistema de múltiplas mensagens
let multiMessageMode = false;
let messageQueue = [];
let editingMessageIndex = null; // Índice da mensagem sendo editada (null = não está editando)

// Referências DOM
const embedsContainer = document.getElementById("embedsContainer");
const preview = document.getElementById("preview");

// Event Listeners principais
document.getElementById("addEmbed").onclick = () => {
  const newEmbed = createEmptyEmbed();
  const newIndex = embeds.length;
  embeds.push(newEmbed);
  renderAllEmbeds();
  
  // Garante que o novo embed seja expandido
  setTimeout(() => {
    const newEmbedBody = document.getElementById(`embedBody${newIndex}`);
    if (newEmbedBody) {
      newEmbedBody.classList.add('show');
    }
  }, 50);
};

document.getElementById("themeToggle").onclick = () => {
  const html = document.documentElement;
  html.setAttribute(
    "data-bs-theme",
    html.getAttribute("data-bs-theme") === "dark" ? "light" : "dark"
  );
  updatePreview(); // Atualiza o preview para refletir o novo tema
};

document.getElementById("exportJson").onclick = () => {
  let exportData;
  let filename;
  
  if (multiMessageMode && messageQueue.length > 0) {
    // Modo múltiplo: exporta o grupo inteiro
    exportData = {
      mode: "multi",
      messages: messageQueue.map(msg => ({
        content: msg.content,
        username: msg.username,
        avatar_url: msg.avatarUrl,
        embeds: convertEmbedsToPayload(msg.embeds)
      }))
    };
    filename = 'webhook-group.json';
  } else {
    // Modo único: exporta a mensagem atual
    const payload = buildPayload(true);
    if (!payload) {
      alert(i18n.t('messages.noContent'));
      return;
    }
    exportData = {
      mode: "single",
      message: payload
    };
    filename = 'webhook-message.json';
  }
  
  const json = JSON.stringify(exportData, null, 2);
  
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  navigator.clipboard.writeText(json).then(() => {
    alert(i18n.t('messages.jsonCopied'));
  });
};

document.getElementById("importJsonBtn").onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        handleJsonImport(parsed);
      } catch (e) {
        alert(i18n.t('messages.importError', { error: e.message }));
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
};

document.getElementById("sendBtn").onclick = sendWebhook;

// Sincronização dos campos de Webhook URL
const webhookUrlInput = document.getElementById("webhookUrl");
const queueWebhookUrlInput = document.getElementById("queueWebhookUrl");

if (webhookUrlInput && queueWebhookUrlInput) {
  // Quando mudar o campo normal, atualiza o campo do grupo
  webhookUrlInput.addEventListener("input", () => {
    queueWebhookUrlInput.value = webhookUrlInput.value;
  });
  
  // Quando mudar o campo do grupo, atualiza o campo normal
  queueWebhookUrlInput.addEventListener("input", () => {
    webhookUrlInput.value = queueWebhookUrlInput.value;
  });
}

// Event Listeners do modo múltiplas mensagens (somente se habilitado)
if (ENABLE_MULTI_MESSAGE_MODE) {
  const multiModeToggle = document.getElementById("multiModeToggle");
  const addToQueueBtn = document.getElementById("addToQueueBtn");
  const sendAllBtn = document.getElementById("sendAllBtn");
  const clearQueueBtn = document.getElementById("clearQueueBtn");
  
  if (multiModeToggle) multiModeToggle.onclick = toggleMultiMessageMode;
  if (addToQueueBtn) addToQueueBtn.onclick = addToQueue;
  if (sendAllBtn) sendAllBtn.onclick = sendAllMessages;
  if (clearQueueBtn) clearQueueBtn.onclick = clearQueue;
} else {
  // Oculta o botão de modo múltiplo se a funcionalidade estiver desabilitada
  const multiModeToggle = document.getElementById("multiModeToggle");
  if (multiModeToggle) {
    multiModeToggle.style.display = 'none';
  }
}

// Cria estrutura vazia de um embed
function createEmptyEmbed() {
  return {
    title: "",
    description: "",
    color: "#5865F2",
    url: "",
    authorName: "",
    authorUrl: "",
    authorIcon: "",
    thumbnailUrl: "",
    imageUrl: "",
    footerText: "",
    footerIcon: "",
    timestamp: false,
    fields: []
  };
}

// Renderiza TODOS os embeds do zero (usado apenas em importação)
function renderAllEmbeds() {
  // Salva o estado de expansão/colapso de cada embed E seus accordions antes de re-renderizar
  const expandedStates = {};
  embeds.forEach((_, index) => {
    const bodyElement = document.getElementById(`embedBody${index}`);
    if (bodyElement) {
      expandedStates[index] = {
        main: bodyElement.classList.contains('show'),
        author: document.getElementById(`author${index}`)?.classList.contains('show') || false,
        images: document.getElementById(`images${index}`)?.classList.contains('show') || false,
        footer: document.getElementById(`footer${index}`)?.classList.contains('show') || false,
        fields: document.getElementById(`fields${index}`)?.classList.contains('show') || false
      };
    }
  });
  
  embedsContainer.innerHTML = "";
  
  if (embeds.length === 0) {
    updatePreview();
    return;
  }

  embeds.forEach((embed, index) => {
    renderNewEmbed(index);
    
    // Restaura o estado de expansão/colapso
    if (expandedStates[index] !== undefined) {
      const bodyElement = document.getElementById(`embedBody${index}`);
      if (bodyElement) {
        if (expandedStates[index].main) {
          bodyElement.classList.add('show');
        } else {
          bodyElement.classList.remove('show');
        }
      }
      
      // Restaura accordions internos
      const accordions = {
        author: document.getElementById(`author${index}`),
        images: document.getElementById(`images${index}`),
        footer: document.getElementById(`footer${index}`),
        fields: document.getElementById(`fields${index}`)
      };
      
      Object.keys(accordions).forEach(key => {
        const element = accordions[key];
        if (element) {
          if (expandedStates[index][key]) {
            element.classList.add('show');
          } else {
            element.classList.remove('show');
          }
        }
      });
    }
  });
  
  updatePreview();
}

// Renderiza UM embed específico
function renderNewEmbed(index) {
  if (embeds.length === 0) {
    return;
  }
  
  // Remove mensagem de "nenhum embed" se existir
  const noEmbedsMsg = embedsContainer.querySelector('p.text-muted');
  if (noEmbedsMsg) {
    noEmbedsMsg.remove();
  }

  const embed = embeds[index];
  const embedCard = document.createElement('div');
  embedCard.className = 'card mb-3';
  embedCard.id = `embed-${index}`;
  
  // Gera preview do embed para o cabeçalho
  const getEmbedPreview = () => {
    const title = embed.title ? embed.title.substring(0, 40) : '';
    const description = embed.description ? embed.description.substring(0, 60) : '';
    
    if (title && description) {
      return `<strong>${escapeHtml(title)}</strong> <span class="text-muted small">— ${escapeHtml(description)}${description.length > 60 ? '...' : ''}</span>`;
    } else if (title) {
      return `<strong>${escapeHtml(title)}</strong>`;
    } else if (description) {
      return `<span class="text-muted">${escapeHtml(description)}${description.length > 60 ? '...' : ''}</span>`;
    } else {
      return `<span class="text-muted">${i18n.t('embed.embed')} ${index + 1}</span>`;
    }
  };
  
  embedCard.innerHTML = `
    <div class="card-header d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center flex-grow-1 min-width-0">
        <button class="btn btn-sm btn-light me-2 drag-handle" title="${t('embed.drag')}">
          <i class="bi bi-arrows-move"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary me-2 embed-collapse-btn" type="button" data-bs-toggle="collapse" data-bs-target="#embedBody${index}" aria-expanded="true" title="${t('embed.expandCollapse')}">
          <i class="bi bi-chevron-down"></i>
        </button>
        <div class="text-truncate">
          <i class="bi bi-layers"></i> ${getEmbedPreview()}
        </div>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveEmbedUp(${index})" ${index === 0 ? 'disabled' : ''} title="${t('embed.moveUp')}">
          <i class="bi bi-arrow-up"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="moveEmbedDown(${index})" ${index === embeds.length - 1 ? 'disabled' : ''} title="${t('embed.moveDown')}">
          <i class="bi bi-arrow-down"></i>
        </button>
        <button class="btn btn-sm btn-danger" data-action="remove-embed" data-index="${index}">
          <i class="bi bi-trash"></i> ${t('embed.remove')}
        </button>
      </div>
    </div>
    <div id="embedBody${index}" class="collapse show">
      <div class="card-body">
      
      <div class="mb-3">
        <label class="form-label fw-bold">${t('embed.title')}</label>
        <input class="form-control" 
          placeholder="${t('embed.titlePlaceholder')}"
          value="${embed.title}"
          data-embed="${index}"
          data-field="title">
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">${t('embed.titleUrl')}</label>
        <input class="form-control" 
          placeholder="${t('embed.titleUrlPlaceholder')}"
          value="${embed.url}"
          data-embed="${index}"
          data-field="url">
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">${t('embed.description')}</label>
        <textarea class="form-control" rows="3"
          placeholder="${t('embed.descriptionPlaceholder')}"
          data-embed="${index}"
          data-field="description">${embed.description}</textarea>
      </div>

      <div class="mb-3">
        <label class="form-label fw-bold">${t('embed.color')}</label>
        <div class="d-flex gap-2 align-items-center">
          <input type="color" class="form-control form-control-color" value="${embed.color}"
            data-embed="${index}"
            data-field="color">
          <input type="text" class="form-control" value="${embed.color}"
            data-embed="${index}"
            data-field="color">
        </div>
      </div>

      <hr>

      <div class="accordion mb-3" id="accordion${index}">
        
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#author${index}">
              <i class="bi bi-person"></i> ${t('embed.author')}
            </button>
          </h2>
          <div id="author${index}" class="accordion-collapse collapse" data-bs-parent="#accordion${index}">
            <div class="accordion-body">
              <div class="mb-2">
                <input class="form-control" placeholder="${t('embed.authorName')}"
                  value="${embed.authorName}"
                  data-embed="${index}"
                  data-field="authorName">
              </div>
              <div class="mb-2">
                <input class="form-control" placeholder="${t('embed.authorUrl')}"
                  value="${embed.authorUrl}"
                  data-embed="${index}"
                  data-field="authorUrl">
              </div>
              <div>
                <input class="form-control" placeholder="${t('embed.authorIcon')}"
                  value="${embed.authorIcon}"
                  data-embed="${index}"
                  data-field="authorIcon">
              </div>
            </div>
          </div>
        </div>

        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#images${index}">
              <i class="bi bi-image"></i> ${t('embed.images')}
            </button>
          </h2>
          <div id="images${index}" class="accordion-collapse collapse" data-bs-parent="#accordion${index}">
            <div class="accordion-body">
              <div class="mb-2">
                <label class="form-label">${t('embed.thumbnail')}</label>
                <input class="form-control" placeholder="${t('embed.titleUrlPlaceholder')}"
                  value="${embed.thumbnailUrl}"
                  data-embed="${index}"
                  data-field="thumbnailUrl">
              </div>
              <div>
                <label class="form-label">${t('embed.image')}</label>
                <input class="form-control" placeholder="${t('embed.titleUrlPlaceholder')}"
                  value="${embed.imageUrl}"
                  data-embed="${index}"
                  data-field="imageUrl">
              </div>
            </div>
          </div>
        </div>

        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#footer${index}">
              <i class="bi bi-layout-text-sidebar-reverse"></i> ${t('embed.footer')}
            </button>
          </h2>
          <div id="footer${index}" class="accordion-collapse collapse" data-bs-parent="#accordion${index}">
            <div class="accordion-body">
              <div class="mb-2">
                <input class="form-control" placeholder="${t('embed.footerText')}"
                  value="${embed.footerText}"
                  data-embed="${index}"
                  data-field="footerText">
              </div>
              <div class="mb-2">
                <input class="form-control" placeholder="${t('embed.footerIcon')}"
                  value="${embed.footerIcon}"
                  data-embed="${index}"
                  data-field="footerIcon">
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox"
                  ${embed.timestamp ? "checked" : ""}
                  data-embed="${index}"
                  data-field="timestamp">
                <label class="form-check-label">${t('embed.timestamp')}</label>
              </div>
            </div>
          </div>
        </div>

        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#fields${index}">
              <i class="bi bi-list-ul"></i> ${t('embed.fields')} (<span id="fieldCount${index}">${embed.fields.length}</span>)
            </button>
          </h2>
          <div id="fields${index}" class="accordion-collapse collapse" data-bs-parent="#accordion${index}">
            <div class="accordion-body">
              <button class="btn btn-sm btn-outline-primary mb-2" data-action="add-field" data-index="${index}">
                <i class="bi bi-plus"></i> ${t('embed.addField')}
              </button>
              <div id="fieldsContainer${index}">
                ${renderFieldsHTML(embed, index)}
              </div>
            </div>
          </div>
        </div>

      </div>

      </div>
    </div>
  `;
  
  embedsContainer.appendChild(embedCard);
  embedCard.dataset.embedIndex = index;
  embedCard.dataset.dragType = 'embed'; // Marca como embed para drag and drop
  
  // Sistema de drag and drop melhorado
  const handle = embedCard.querySelector('.drag-handle');
  if (handle) {
    handle.setAttribute('draggable', 'true');
    
    handle.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index.toString());
      e.dataTransfer.setData('drag-type', 'embed'); // Identifica tipo de drag
      e.dataTransfer.effectAllowed = 'move';
      embedCard.classList.add('dragging');
      
      // Cria uma imagem de arrasto customizada
      const ghost = embedCard.cloneNode(true);
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.opacity = '0.8';
      ghost.style.width = embedCard.offsetWidth + 'px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
    });

    handle.addEventListener('dragend', (e) => {
      embedCard.classList.remove('dragging');
      // Remove todos os indicadores de drop
      document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
      document.querySelectorAll('.drop-target-above, .drop-target-below').forEach(el => {
        el.classList.remove('drop-target-above', 'drop-target-below');
      });
    });
  }

  embedCard.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const draggingCard = document.querySelector('.dragging');
    if (!draggingCard || draggingCard === embedCard) return;
    
    // Só aplica indicadores se estiver arrastando um embed
    if (draggingCard.dataset.dragType !== 'embed') return;
    
    // Calcula se o mouse está na metade superior ou inferior do card
    const rect = embedCard.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = e.clientY < midpoint;
    
    // Remove classes anteriores
    embedCard.classList.remove('drop-target-above', 'drop-target-below');
    
    // Adiciona classe apropriada
    if (isAbove) {
      embedCard.classList.add('drop-target-above');
    } else {
      embedCard.classList.add('drop-target-below');
    }
  });
  
  embedCard.addEventListener('dragleave', (e) => {
    // Remove o indicador quando sai da área
    if (!embedCard.contains(e.relatedTarget)) {
      embedCard.classList.remove('drop-target-above', 'drop-target-below');
    }
  });

  embedCard.addEventListener('drop', (e) => {
    e.preventDefault();
    embedCard.classList.remove('drop-target-above', 'drop-target-below');
    
    const src = parseInt(e.dataTransfer.getData('text/plain'));
    const dest = parseInt(embedCard.dataset.embedIndex);
    
    if (isNaN(src) || isNaN(dest) || src === dest) return;
    
    // Determina se deve inserir antes ou depois baseado na posição do mouse
    const rect = embedCard.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;
    
    // Calcula a posição final de inserção
    let finalDest;
    if (insertBefore) {
      // Inserir antes do destino
      finalDest = src < dest ? dest - 1 : dest;
    } else {
      // Inserir depois do destino
      finalDest = src < dest ? dest : dest + 1;
    }
    
    if (finalDest >= 0 && finalDest !== src) {
      reorderEmbeds(src, finalDest);
    }
  });

  attachEmbedListeners(embedCard, index);
  
  // Adiciona listener para mudar ícone do botão de colapso PRINCIPAL do embed
  const collapseElement = embedCard.querySelector(`#embedBody${index}`);
  const toggleButton = embedCard.querySelector('.embed-collapse-btn');
  
  if (collapseElement && toggleButton) {
    collapseElement.addEventListener('shown.bs.collapse', (event) => {
      // Só muda o ícone se o evento for do próprio embedBody, não dos accordions internos
      if (event.target.id === `embedBody${index}`) {
        toggleButton.querySelector('i').className = 'bi bi-chevron-down';
      }
    });
    
    collapseElement.addEventListener('hidden.bs.collapse', (event) => {
      // Só muda o ícone se o evento for do próprio embedBody, não dos accordions internos
      if (event.target.id === `embedBody${index}`) {
        toggleButton.querySelector('i').className = 'bi bi-chevron-right';
      }
    });
  }
}

// Gera HTML dos fields (sem event listeners inline)
function renderFieldsHTML(embed, embedIndex) {
  if (embed.fields.length === 0) {
    return '';
  }

  return embed.fields.map((f, fieldIndex) => `
    <div class="card mb-2" id="field-${embedIndex}-${fieldIndex}" data-embed="${embedIndex}" data-field-index="${fieldIndex}">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-2">
          <div class="d-flex align-items-center">
            <button class="btn btn-sm btn-light me-2 drag-handle" title="${t('queue.drag')}">
              <i class="bi bi-arrows-move"></i>
            </button>
            <small class="text-muted">Field ${fieldIndex + 1}</small>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-secondary" onclick="moveFieldUp(${embedIndex}, ${fieldIndex})" ${fieldIndex === 0 ? 'disabled' : ''} title="${t('embed.moveUp')}">
              <i class="bi bi-arrow-up"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="moveFieldDown(${embedIndex}, ${fieldIndex})" ${fieldIndex === embed.fields.length - 1 ? 'disabled' : ''} title="${t('embed.moveDown')}">
              <i class="bi bi-arrow-down"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-action="remove-field" data-embed="${embedIndex}" data-field="${fieldIndex}">
              <i class="bi bi-x"></i>
            </button>
          </div>
        </div>
        <div class="mb-2">
          <input class="form-control form-control-sm" placeholder="${t('embed.fieldName')}"
            value="${f.name}"
            data-embed="${embedIndex}"
            data-field-index="${fieldIndex}"
            data-field-prop="name">
        </div>
        <div class="mb-2">
          <textarea class="form-control form-control-sm" rows="2" placeholder="${t('embed.fieldValue')}"
            data-embed="${embedIndex}"
            data-field-index="${fieldIndex}"
            data-field-prop="value">${f.value}</textarea>
        </div>
        <div class="form-check">
          <input type="checkbox" class="form-check-input"
            ${f.inline ? "checked" : ""}
            data-embed="${embedIndex}"
            data-field-index="${fieldIndex}"
            data-field-prop="inline">
          <label class="form-check-label small">${t('embed.inline')}</label>
        </div>
      </div>
    </div>
  `).join("");
}

// Anexa event listeners usando delegação de eventos
function attachEmbedListeners(embedCard, embedIndex) {
  // Função para atualizar o preview no cabeçalho
  const updateHeaderPreview = () => {
    const embed = embeds[embedIndex];
    const title = embed.title ? embed.title.substring(0, 40) : '';
    const description = embed.description ? embed.description.substring(0, 60) : '';
    
    let previewHTML;
    if (title && description) {
      previewHTML = `<strong>${escapeHtml(title)}</strong> <span class="text-muted small">— ${escapeHtml(description)}${description.length > 60 ? '...' : ''}</span>`;
    } else if (title) {
      previewHTML = `<strong>${escapeHtml(title)}</strong>`;
    } else if (description) {
      previewHTML = `<span class="text-muted">${escapeHtml(description)}${description.length > 60 ? '...' : ''}</span>`;
    } else {
      previewHTML = `<span class="text-muted">${t('embed.embed')} ${embedIndex + 1}</span>`;
    }
    
    const previewContainer = embedCard.querySelector('.text-truncate');
    if (previewContainer) {
      previewContainer.innerHTML = `<i class="bi bi-layers"></i> ${previewHTML}`;
    }
  };
  
  // Inputs de texto e textareas
  embedCard.querySelectorAll('input[data-field], textarea[data-field]').forEach(input => {
    const field = input.dataset.field;
    input.addEventListener('input', (e) => {
      embeds[embedIndex][field] = e.target.value;
      
      // Atualiza o preview do cabeçalho se for título ou descrição
      if (field === 'title' || field === 'description') {
        updateHeaderPreview();
      }
      
      updatePreview();
    });
  });

  // Checkbox de timestamp
  const timestampCheckbox = embedCard.querySelector('input[data-field="timestamp"]');
  if (timestampCheckbox) {
    timestampCheckbox.addEventListener('change', (e) => {
      embeds[embedIndex].timestamp = e.target.checked;
      updatePreview();
    });
  }

  // Botões de ação
  embedCard.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const index = parseInt(button.dataset.index);

    if (action === 'remove-embed') {
      removeEmbed(index);
    } else if (action === 'add-field') {
      addField(index);
    } else if (action === 'remove-field') {
      const embedIdx = parseInt(button.dataset.embed);
      const fieldIdx = parseInt(button.dataset.field);
      removeField(embedIdx, fieldIdx);
    }
  });

  // Fields inputs
  attachFieldListeners(embedIndex);
}

// Anexa listeners aos inputs de fields
function attachFieldListeners(embedIndex) {
  const fieldsContainer = document.getElementById(`fieldsContainer${embedIndex}`);
  if (!fieldsContainer) return;

  fieldsContainer.querySelectorAll('input[data-field-prop], textarea[data-field-prop]').forEach(input => {
    const fieldIndex = parseInt(input.dataset.fieldIndex);
    const prop = input.dataset.fieldProp;

    if (prop === 'inline') {
      input.addEventListener('change', (e) => {
        embeds[embedIndex].fields[fieldIndex].inline = e.target.checked;
        updatePreview();
      });
    } else {
      input.addEventListener('input', (e) => {
        embeds[embedIndex].fields[fieldIndex][prop] = e.target.value;
        updatePreview();
      });
    }
  });

  // Drag & drop para reordenar fields (sistema melhorado)
  fieldsContainer.querySelectorAll('.card[id^="field-"]').forEach(card => {
    const fieldIdx = parseInt(card.dataset.fieldIndex);
    const embedIdx = parseInt(card.dataset.embed);
    card.dataset.dragType = 'field'; // Marca como field para drag and drop

    const handle = card.querySelector('.drag-handle');
    if (handle) {
      handle.setAttribute('draggable', 'true');
      
      handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', `${embedIdx}:${fieldIdx}`);
        e.dataTransfer.setData('drag-type', 'field'); // Identifica tipo de drag
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        
        // Cria uma imagem de arrasto customizada
        const ghost = card.cloneNode(true);
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        ghost.style.opacity = '0.8';
        ghost.style.width = card.offsetWidth + 'px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
      });

      handle.addEventListener('dragend', (e) => {
        card.classList.remove('dragging');
        // Remove todos os indicadores de drop
        fieldsContainer.querySelectorAll('.drop-target-above, .drop-target-below').forEach(el => {
          el.classList.remove('drop-target-above', 'drop-target-below');
        });
      });
    }

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingCard = document.querySelector('.dragging');
      if (!draggingCard || draggingCard === card) return;
      
      // Só aplica indicadores se estiver arrastando um field
      if (draggingCard.dataset.dragType !== 'field') return;
      
      // Calcula se o mouse está na metade superior ou inferior do card
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const isAbove = e.clientY < midpoint;
      
      // Remove classes anteriores
      card.classList.remove('drop-target-above', 'drop-target-below');
      
      // Adiciona classe apropriada
      if (isAbove) {
        card.classList.add('drop-target-above');
      } else {
        card.classList.add('drop-target-below');
      }
    });
    
    card.addEventListener('dragleave', (e) => {
      // Remove o indicador quando sai da área
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove('drop-target-above', 'drop-target-below');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drop-target-above', 'drop-target-below');
      
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;
      const [srcEmbed, srcField] = data.split(':').map(n => parseInt(n));
      const destEmbed = parseInt(card.dataset.embed);
      const destField = parseInt(card.dataset.fieldIndex);

      if (isNaN(srcEmbed) || isNaN(srcField) || isNaN(destEmbed) || isNaN(destField)) return;

      // Só permite reordenar dentro do mesmo embed
      if (srcEmbed === destEmbed && srcField !== destField) {
        // Determina se deve inserir antes ou depois baseado na posição do mouse
        const rect = card.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midpoint;
        
        // Calcula a posição final de inserção
        let finalDest;
        if (insertBefore) {
          // Inserir antes do destino
          finalDest = srcField < destField ? destField - 1 : destField;
        } else {
          // Inserir depois do destino
          finalDest = srcField < destField ? destField : destField + 1;
        }
        
        if (finalDest >= 0 && finalDest !== srcField) {
          reorderFields(srcEmbed, srcField, finalDest);
        }
      }
    });
  });
}

// Adiciona um field a um embed específico
function addField(embedIndex) {
  embeds[embedIndex].fields.push({ name: "", value: "", inline: false });
  
  // Re-renderiza apenas o container de fields
  const fieldsContainer = document.getElementById(`fieldsContainer${embedIndex}`);
  const fieldCount = document.getElementById(`fieldCount${embedIndex}`);
  
  if (fieldsContainer) {
    fieldsContainer.innerHTML = renderFieldsHTML(embeds[embedIndex], embedIndex);
    attachFieldListeners(embedIndex);
  }
  
  if (fieldCount) {
    fieldCount.textContent = embeds[embedIndex].fields.length;
  }
  
  updatePreview();
}

// Remove um field específico
function removeField(embedIndex, fieldIndex) {
  embeds[embedIndex].fields.splice(fieldIndex, 1);
  
  // Re-renderiza apenas o container de fields
  const fieldsContainer = document.getElementById(`fieldsContainer${embedIndex}`);
  const fieldCount = document.getElementById(`fieldCount${embedIndex}`);
  
  if (fieldsContainer) {
    fieldsContainer.innerHTML = renderFieldsHTML(embeds[embedIndex], embedIndex);
    attachFieldListeners(embedIndex);
  }
  
  if (fieldCount) {
    fieldCount.textContent = embeds[embedIndex].fields.length;
  }
  
  updatePreview();
}

// Remove um embed completo
function removeEmbed(index) {
  if (confirm(i18n.t('messages.confirmRemoveEmbed'))) {
    embeds.splice(index, 1);
    
    // Re-renderiza tudo ao remover um embed (índices mudam)
    renderAllEmbeds();
  }
}

// Reordena o array de embeds: move src para antes de dest
function reorderEmbeds(src, dest) {
  if (src < 0 || dest < 0 || src >= embeds.length || dest >= embeds.length) return;
  
  // Salva o estado de colapso de todos os embeds antes de re-renderizar
  const collapseStates = [];
  embeds.forEach((embed, index) => {
    const collapseElement = document.getElementById(`embedBody${index}`);
    collapseStates[index] = collapseElement && collapseElement.classList.contains('show');
  });
  
  const [moved] = embeds.splice(src, 1);
  embeds.splice(dest, 0, moved);
  
  // Move o estado de colapso junto com o embed
  const [movedState] = collapseStates.splice(src, 1);
  collapseStates.splice(dest, 0, movedState);
  
  renderAllEmbeds();
  
  // Restaura o estado de colapso após re-renderizar
  collapseStates.forEach((isExpanded, index) => {
    const collapseElement = document.getElementById(`embedBody${index}`);
    const toggleButton = document.querySelector(`.embed-collapse-btn[data-bs-target="#embedBody${index}"]`);
    
    if (collapseElement) {
      if (isExpanded) {
        collapseElement.classList.add('show');
        if (toggleButton) {
          toggleButton.querySelector('i').className = 'bi bi-chevron-down';
          toggleButton.setAttribute('aria-expanded', 'true');
        }
      } else {
        collapseElement.classList.remove('show');
        if (toggleButton) {
          toggleButton.querySelector('i').className = 'bi bi-chevron-right';
          toggleButton.setAttribute('aria-expanded', 'false');
        }
      }
    }
  });
  
  updatePreview();
}

// Reordena fields dentro de um embed
function reorderFields(embedIndex, srcFieldIndex, destFieldIndex) {
  const fields = embeds[embedIndex] && embeds[embedIndex].fields;
  if (!fields) return;
  if (srcFieldIndex < 0 || destFieldIndex < 0 || srcFieldIndex >= fields.length || destFieldIndex >= fields.length) return;
  const [moved] = fields.splice(srcFieldIndex, 1);
  fields.splice(destFieldIndex, 0, moved);

  // Atualiza o container e listeners
  const fieldsContainer = document.getElementById(`fieldsContainer${embedIndex}`);
  const fieldCount = document.getElementById(`fieldCount${embedIndex}`);
  if (fieldsContainer) {
    fieldsContainer.innerHTML = renderFieldsHTML(embeds[embedIndex], embedIndex);
    attachFieldListeners(embedIndex);
  }
  if (fieldCount) fieldCount.textContent = fields.length;
  updatePreview();
}

// Formata o conteúdo da mensagem com componentes Discord
// Usa @skyra/discord-components-core v4.0.2
// Componentes disponíveis:
//   - Markup: <discord-bold>, <discord-italic>, <discord-underlined>, <discord-code>, <discord-pre>, <discord-spoiler>, <discord-quote>
//   - Interativos: <discord-mention>, <discord-time>
//   - HTML inline: headers, listas, links, slash commands (sem componentes dedicados)
function formatDiscordContent(text) {
  if (!text) return '';
  
  // ========== ETAPA 1: PRESERVAR CODE BLOCKS E INLINE CODE ==========
  const codeBlocks = [];
  const inlineCodes = [];
  
  // Extrai code blocks primeiro (```)
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code);
    return `__CODEBLOCK_${codeBlocks.length - 1}__`;
  });
  
  // Extrai inline code (`)
  text = text.replace(/`([^`]+)`/g, (match, code) => {
    inlineCodes.push(code);
    return `__INLINECODE_${inlineCodes.length - 1}__`;
  });
  
  let formatted = text;
  
  // ========== ETAPA 2: PROCESSAR SINTAXE COM <> ANTES DE ESCAPAR HTML ==========
  
  // TIMESTAMPS (<t:1234567890:F>)
  formatted = formatted.replace(/<t:(\d+)(?::([tTdDfFR]))?>/g, (match, timestamp, style) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const styleFormat = style || 'f';
    let formattedDate;
    
    switch(styleFormat) {
      case 't': formattedDate = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); break;
      case 'T': formattedDate = date.toLocaleTimeString('pt-BR'); break;
      case 'd': formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); break;
      case 'D': formattedDate = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }); break;
      case 'f': formattedDate = date.toLocaleString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); break;
      case 'F': formattedDate = date.toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); break;
      case 'R': 
        const now = Date.now();
        const diff = now - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) formattedDate = `há ${days} dia${days > 1 ? 's' : ''}`;
        else if (hours > 0) formattedDate = `há ${hours} hora${hours > 1 ? 's' : ''}`;
        else if (minutes > 0) formattedDate = `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        else formattedDate = `há ${seconds} segundo${seconds > 1 ? 's' : ''}`;
        break;
      default: formattedDate = date.toLocaleString('pt-BR');
    }
    
    return `╰TIMESTAMP╯${formattedDate}╰/TIMESTAMP╯`;
  });
  
  // USER MENTIONS (<@123456789> ou <@!123456789>)
  formatted = formatted.replace(/<@!?(\d+)>/g, '╰MENTION╯User-$1╰/MENTION╯');
  
  // CHANNEL MENTIONS (<#123456789>)
  formatted = formatted.replace(/<#(\d+)>/g, '╰CHANNEL╯channel-$1╰/CHANNEL╯');
  
  // ROLE MENTIONS (<@&123456789>)
  formatted = formatted.replace(/<@&(\d+)>/g, '╰ROLE╯Role-$1╰/ROLE╯');
  
  // SLASH COMMANDS (</command:123456789>)
  formatted = formatted.replace(/<\/([^:>\s]+):(\d+)>/g, '╰SLASHCMD╯$1╰/SLASHCMD╯');
  
  // CUSTOM EMOJI (<:name:123> e <a:name:123>)
  formatted = formatted.replace(/<(a?):([^:>\s]+):(\d+)>/g, (match, animated, name, id) => {
    const ext = animated ? 'gif' : 'png';
    return `╰EMOJI╯${id}|${ext}|${name}╰/EMOJI╯`;
  });
  
  // GUILD NAVIGATION (<id:guide>)
  formatted = formatted.replace(/<id:(customize|browse|guide|linked-roles)>/g, '╰GUILD╯$1╰/GUILD╯');
  
  // ========== ETAPA 3: ESCAPAR HTML PARA SEGURANÇA ==========
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // ========== ETAPA 4: PROCESSAR QUOTES (>>> e >) ==========
  
  // MULTI-LINE QUOTE (>>> captura TODO o texto restante)
  // Processa linha por linha para encontrar >>>
  const lines = formatted.split('\n');
  let multiQuoteStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('&gt;&gt;&gt;')) {
      multiQuoteStartIndex = i;
      // Remove os >>> e captura o resto
      lines[i] = lines[i].replace(/^\s*&gt;&gt;&gt;\s*/, '');
      break;
    }
  }
  
  if (multiQuoteStartIndex !== -1) {
    // Processar citações simples ANTES do >>>
    const beforeQuote = lines.slice(0, multiQuoteStartIndex);
    const processedBefore = beforeQuote.map(line => {
      return line.replace(/^&gt;\s+(.+)$/, '╰QUOTE╯$1╰/QUOTE╯');
    });
    
    // Capturar tudo após >>> (inclusive a linha do >>>)
    const quoteLines = lines.slice(multiQuoteStartIndex);
    
    // Remove > do início de cada linha dentro da multi-quote
    const cleanedQuote = quoteLines.map(line => line.replace(/^&gt;\s*/, '')).join('\n');
    
    formatted = processedBefore.join('\n') + 
                (processedBefore.length > 0 ? '\n' : '') + 
                '╰MULTIQUOTE╯' + cleanedQuote + '╰/MULTIQUOTE╯';
  } else {
    // Não há >>>, então processa todas as linhas com > como citações simples
    formatted = formatted.replace(/^&gt;\s+(.+)$/gm, '╰QUOTE╯$1╰/QUOTE╯');
  }
  
  // ========== ETAPA 5: PROCESSAR HEADERS ==========
  formatted = formatted.replace(/^###\s+(.+)$/gm, '╰H3╯$1╰/H3╯');
  formatted = formatted.replace(/^##\s+(.+)$/gm, '╰H2╯$1╰/H2╯');
  formatted = formatted.replace(/^#\s+(.+)$/gm, '╰H1╯$1╰/H1╯');
  formatted = formatted.replace(/^-#\s+(.+)$/gm, '╰SUBTEXT╯$1╰/SUBTEXT╯');
  
  // ========== ETAPA 6: PROCESSAR LINKS E LISTAS ==========
  
  // MASKED LINKS ([texto](url))
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '╰LINK╯$2|$1╰/LINK╯');
  
  // LISTAS NÃO-ORDENADAS (- ou *)
  formatted = formatted.replace(/^[\*\-]\s+(.+)$/gm, '╰BULLET╯$1╰/BULLET╯');
  
  // LISTAS ORDENADAS (1. 2. 3.)
  formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '╰NUMBER╯$1|$2╰/NUMBER╯');
  
  // ========== ETAPA 7: PROCESSAR FORMATAÇÃO DE TEXTO ==========
  
  // COMBINAÇÕES COMPLEXAS (processar primeiro)
  // Bold + Italic + Underline (___texto___)
  formatted = formatted.replace(/___([^_\n]+)___/g, '╰BIU╯$1╰/BIU╯');
  
  // Bold + Italic (***texto***)
  formatted = formatted.replace(/\*\*\*([^*\n]+)\*\*\*/g, '╰BI╯$1╰/BI╯');
  
  // Bold + Underline (__**texto**__)
  formatted = formatted.replace(/__\*\*([^*\n]+)\*\*__/g, '╰BU╯$1╰/BU╯');
  
  // Italic + Underline (__*texto*__)
  formatted = formatted.replace(/__\*([^*\n]+)\*__/g, '╰IU╯$1╰/IU╯');
  
  // FORMATAÇÕES SIMPLES
  // Bold (**texto**)
  formatted = formatted.replace(/\*\*([^*\n]+)\*\*/g, '╰B╯$1╰/B╯');
  
  // Underline (__texto__)
  formatted = formatted.replace(/__([^_\n]+)__/g, '╰U╯$1╰/U╯');
  
  // Italic (*texto* ou _texto_) - mais cuidado aqui
  formatted = formatted.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '╰I╯$1╰/I╯');
  formatted = formatted.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '╰I╯$1╰/I╯');
  
  // Strikethrough (~~texto~~)
  formatted = formatted.replace(/~~([^~\n]+)~~/g, '╰S╯$1╰/S╯');
  
  // Spoiler (||texto||)
  formatted = formatted.replace(/\|\|([^|\n]+)\|\|/g, '╰SPOILER╯$1╰/SPOILER╯');
  
  // @everyone e @here
  formatted = formatted.replace(/@everyone\b/g, '╰EVERYONE╯everyone╰/EVERYONE╯');
  formatted = formatted.replace(/@here\b/g, '╰HERE╯here╰/HERE╯');
  
  // ========== ETAPA 8: CONVERTER MARCADORES PARA COMPONENTES DISCORD ==========
  
  // Timestamps - usa componente <discord-time>
  formatted = formatted.replace(/╰TIMESTAMP╯(.*?)╰\/TIMESTAMP╯/g, '<discord-time>$1</discord-time>');
  
  // Mentions - usa componente <discord-mention>
  formatted = formatted.replace(/╰MENTION╯(.*?)╰\/MENTION╯/g, '<discord-mention>$1</discord-mention>');
  formatted = formatted.replace(/╰CHANNEL╯(.*?)╰\/CHANNEL╯/g, '<discord-mention type="channel">$1</discord-mention>');
  formatted = formatted.replace(/╰ROLE╯(.*?)╰\/ROLE╯/g, '<discord-mention type="role">$1</discord-mention>');
  formatted = formatted.replace(/╰EVERYONE╯(.*?)╰\/EVERYONE╯/g, '<discord-mention type="role" highlight>$1</discord-mention>');
  formatted = formatted.replace(/╰HERE╯(.*?)╰\/HERE╯/g, '<discord-mention type="role" highlight>$1</discord-mention>');
  
  // Commands & Guild Navigation - não há componente dedicado, usa span com estilo Discord
  formatted = formatted.replace(/╰SLASHCMD╯(.*?)╰\/SLASHCMD╯/g, '<span style="background: rgba(88,101,242,0.3); padding: 0 2px; border-radius: 3px; color: #00a8fc; cursor: pointer;">/$1</span>');
  formatted = formatted.replace(/╰GUILD╯(.*?)╰\/GUILD╯/g, '<span style="color: #00a8fc; background: rgba(88,101,242,0.15); padding: 0 2px; border-radius: 3px; cursor: pointer;">$1</span>');
  
  // Emoji - usa <img> com estilo Discord
  formatted = formatted.replace(/╰EMOJI╯(.*?)\|(.*?)\|(.*?)╰\/EMOJI╯/g, '<img src="https://cdn.discordapp.com/emojis/$1.$2" alt=":$3:" title=":$3:" style="width: 1.375em; height: 1.375em; vertical-align: bottom; object-fit: contain; display: inline-block;">');
  
  // Quotes - usa componente <discord-quote>
  formatted = formatted.replace(/╰QUOTE╯(.*?)╰\/QUOTE╯/g, '<discord-quote>$1</discord-quote>');
  formatted = formatted.replace(/╰MULTIQUOTE╯([\s\S]*?)╰\/MULTIQUOTE╯/g, '<discord-quote>$1</discord-quote>');
  
  // Headers - usa componente <discord-header>
  formatted = formatted.replace(/╰H1╯(.*?)╰\/H1╯/g, '<discord-header level="1">$1</discord-header>');
  formatted = formatted.replace(/╰H2╯(.*?)╰\/H2╯/g, '<discord-header level="2">$1</discord-header>');
  formatted = formatted.replace(/╰H3╯(.*?)╰\/H3╯/g, '<discord-header level="3">$1</discord-header>');
  formatted = formatted.replace(/╰SUBTEXT╯(.*?)╰\/SUBTEXT╯/g, '<span style="font-size: 0.75rem; opacity: 0.6; display: block;">$1</span>');
  
  // Links & Lists - Discord não tem componentes dedicados
  formatted = formatted.replace(/╰LINK╯(.*?)\|(.*?)╰\/LINK╯/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #00a8fc; text-decoration: none; cursor: pointer;">$2</a>');
  formatted = formatted.replace(/╰BULLET╯(.*?)╰\/BULLET╯/g, '<span style="display: block; margin-left: 1em; text-indent: -1em; padding-left: 1em;">• $1</span>');
  formatted = formatted.replace(/╰NUMBER╯(.*?)\|(.*?)╰\/NUMBER╯/g, '<span style="display: block; margin-left: 1em; text-indent: -1em; padding-left: 1em;">$1. $2</span>');
  
  // Text Formatting - usa componentes discord-components onde disponível
  // Combinações primeiro (nested components)
  formatted = formatted.replace(/╰BIU╯(.*?)╰\/BIU╯/g, '<discord-bold><discord-italic><discord-underlined>$1</discord-underlined></discord-italic></discord-bold>');
  formatted = formatted.replace(/╰BI╯(.*?)╰\/BI╯/g, '<discord-bold><discord-italic>$1</discord-italic></discord-bold>');
  formatted = formatted.replace(/╰BU╯(.*?)╰\/BU╯/g, '<discord-bold><discord-underlined>$1</discord-underlined></discord-bold>');
  formatted = formatted.replace(/╰IU╯(.*?)╰\/IU╯/g, '<discord-italic><discord-underlined>$1</discord-underlined></discord-italic>');
  
  // Formatações simples (componentes discord-components)
  formatted = formatted.replace(/╰B╯(.*?)╰\/B╯/g, '<discord-bold>$1</discord-bold>');
  formatted = formatted.replace(/╰I╯(.*?)╰\/I╯/g, '<discord-italic>$1</discord-italic>');
  formatted = formatted.replace(/╰U╯(.*?)╰\/U╯/g, '<discord-underlined>$1</discord-underlined>');
  formatted = formatted.replace(/╰S╯(.*?)╰\/S╯/g, '<s style="text-decoration: line-through;">$1</s>'); // <s> é nativo HTML, Discord não tem componente
  formatted = formatted.replace(/╰SPOILER╯(.*?)╰\/SPOILER╯/g, '<discord-spoiler>$1</discord-spoiler>');
  
  // ========== ETAPA 9: RESTAURAR CODE BLOCKS ==========
  formatted = formatted.replace(/__CODEBLOCK_(\d+)__/g, (match, index) => {
    return '<discord-pre>' + codeBlocks[index] + '</discord-pre>';
  });
  
  formatted = formatted.replace(/__INLINECODE_(\d+)__/g, (match, index) => {
    return '<discord-code>' + inlineCodes[index] + '</discord-code>';
  });
  
  // ========== ETAPA 10: CONVERTER NEWLINES ==========
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

// Atualiza a preview em tempo real
function updatePreview() {
  const username = document.getElementById("username").value || "Webhook";
  // const avatar = document.getElementById("avatar").value;
  const avatar = document.getElementById("avatar").value || "https://fluxerstatic.com/avatars/0.png";
  const content = document.getElementById("content").value;
  
  // Detecta o tema atual (light-theme é usado quando NÃO está em dark)
  const isLightTheme = document.documentElement.getAttribute("data-bs-theme") !== "dark";
  
  // Se não há conteúdo nem embeds, mostra mensagem placeholder
  if (!content && embeds.length === 0) {
    preview.innerHTML = `
      <discord-messages ${isLightTheme ? 'light-theme' : ''}>
        <discord-message bot author="${escapeHtml(username)}" avatar="${avatar || 'blue'}">
          <em style="opacity: 0.6;">${t('preview.placeholder')}</em>
        </discord-message>
      </discord-messages>
    `;
    return;
  }

  // Renderiza a preview completa
  preview.innerHTML = `
    <discord-messages ${isLightTheme ? 'light-theme' : ''}>
      <discord-message bot author="${escapeHtml(username)}" avatar="${avatar || 'blue'}">
        ${formatDiscordContent(content)}
        ${renderPreviewEmbeds()}
      </discord-message>
    </discord-messages>
  `;
}

// Renderiza embeds na preview
function renderPreviewEmbeds() {
  if (embeds.length === 0) {
    return '';
  }

  return embeds.map(embed => {
    // Verifica se o embed tem algum conteúdo
    const hasContent = embed.title || embed.description || embed.fields.length > 0 || 
                       embed.authorName || embed.imageUrl || embed.thumbnailUrl || 
                       embed.footerText;
    
    if (!hasContent) {
      return '';
    }

    const color = embed.color || '#5865F2';
    
    // Monta atributos do embed
    let embedAttrs = `color="${color}"`;
    if (embed.title) embedAttrs += ` embed-title="${escapeHtml(embed.title)}"`;
    if (embed.url) embedAttrs += ` url="${embed.url}"`;
    if (embed.authorName) embedAttrs += ` author-name="${escapeHtml(embed.authorName)}"`;
    if (embed.authorUrl) embedAttrs += ` author-url="${embed.authorUrl}"`;
    if (embed.authorIcon) embedAttrs += ` author-image="${embed.authorIcon}"`;
    if (embed.thumbnailUrl) embedAttrs += ` thumbnail="${embed.thumbnailUrl}"`;
    if (embed.imageUrl) embedAttrs += ` image="${embed.imageUrl}"`;
    
    // Monta os slots internos
    let embedSlots = '';
    
    // Description (com formatação Discord)
    if (embed.description) {
      embedSlots += `<discord-embed-description slot="description">${formatDiscordContent(embed.description)}</discord-embed-description>`;
    }
    
    // Fields (com formatação Discord)
    if (embed.fields.length > 0) {
      const validFields = embed.fields.filter(f => f.name || f.value).map(f => {
        const fieldTitle = escapeHtml(f.name || 'Nome do field');
        const fieldValue = formatDiscordContent(f.value || 'Valor do field');
        return `<discord-embed-field field-title="${fieldTitle}" ${f.inline ? 'inline' : ''}>${fieldValue}</discord-embed-field>`;
      }).join('');
      
      if (validFields) {
        embedSlots += `<discord-embed-fields slot="fields">${validFields}</discord-embed-fields>`;
      }
    }
    
    // Footer
    if (embed.footerText || embed.timestamp) {
      let footerAttrs = '';
      if (embed.footerIcon) footerAttrs += ` footer-image="${embed.footerIcon}"`;
      if (embed.timestamp) footerAttrs += ` timestamp="${new Date().toLocaleDateString('en-US')}"`;
      
      const footerContent = escapeHtml(embed.footerText || '');
      embedSlots += `<discord-embed-footer slot="footer"${footerAttrs}>${footerContent}</discord-embed-footer>`;
    }
    
    return `<discord-embed slot="embeds" ${embedAttrs}>${embedSlots}</discord-embed>`;
  }).filter(html => html !== '').join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimestamp() {
  const now = new Date();
  const today = now.toLocaleDateString('pt-BR');
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${today} ${time}`;
}

// Constrói o payload para enviar ao webhook
function buildPayload(forExport = false) {
  const content = document.getElementById("content").value.trim();
  const username = document.getElementById("username").value.trim();
  const avatarUrl = document.getElementById("avatar").value.trim();

  // Constrói os embeds válidos
  const validEmbeds = embeds.map(e => {
    const embed = {};

    // Adiciona campos básicos
    if (e.title) embed.title = e.title;
    if (e.description) embed.description = e.description;
    if (e.url) embed.url = e.url;

    // Converte cor de hex para decimal
    if (e.color) {
      const colorHex = e.color.replace("#", "");
      const colorDecimal = parseInt(colorHex, 16);
      if (!isNaN(colorDecimal)) {
        embed.color = colorDecimal;
      }
    }

    // Author
    if (e.authorName) {
      embed.author = { name: e.authorName };
      if (e.authorUrl) embed.author.url = e.authorUrl;
      if (e.authorIcon) embed.author.icon_url = e.authorIcon;
    }

    // Imagens
    if (e.thumbnailUrl) {
      embed.thumbnail = { url: e.thumbnailUrl };
    }

    if (e.imageUrl) {
      embed.image = { url: e.imageUrl };
    }

    // Footer
    if (e.footerText) {
      embed.footer = { text: e.footerText };
      if (e.footerIcon) embed.footer.icon_url = e.footerIcon;
    }

    // Timestamp
    if (e.timestamp) {
      embed.timestamp = new Date().toISOString();
    }

    // Fields - filtra apenas os que têm nome E valor
    if (e.fields && e.fields.length > 0) {
      const validFields = e.fields
        .filter(f => f.name && f.value)
        .map(f => ({
          name: f.name,
          value: f.value,
          inline: !!f.inline
        }));

      if (validFields.length > 0) {
        embed.fields = validFields;
      }
    }

    // Retorna null se o embed estiver vazio
    if (Object.keys(embed).length === 0) {
      return null;
    }

    // Adiciona o tipo
    embed.type = "rich";
    return embed;
  }).filter(Boolean); // Remove embeds nulos

  // Validação: precisa ter pelo menos conteúdo OU embeds
  if (!content && validEmbeds.length === 0 && !forExport) {
    alert(i18n.t('messages.emptyMessage'));
    return null;
  }

  // Constrói o payload final
  const payload = {};

  if (content) {
    payload.content = content;
  } else if (validEmbeds.length > 0 && !content) {
    // Se tem embeds mas não tem conteúdo, adiciona zero-width space
    payload.content = "\u200B";
  }

  if (username) {
    payload.username = username;
  }

  if (avatarUrl) {
    payload.avatar_url = avatarUrl;
  }

  if (validEmbeds.length > 0) {
    payload.embeds = validEmbeds;
  }

  return payload;
}

// ========== FUNÇÕES DO MODO MÚLTIPLAS MENSAGENS ==========

function toggleMultiMessageMode() {
  if (!ENABLE_MULTI_MESSAGE_MODE) {
    console.warn("Modo múltiplas mensagens está desabilitado na configuração");
    return;
  }
  
  // Se está editando uma mensagem, cancela a edição antes de alternar o modo
  const wasEditing = editingMessageIndex !== null;
  if (wasEditing) {
    editingMessageIndex = null;
    updateQueueUI(); // Remove highlight da mensagem

    /* **************************************************
    // Limpar o formulário ao trocar de modo durante uma edição
    const contentEl = document.getElementById("content");
    const usernameEl = document.getElementById("username");
    const avatarEl = document.getElementById("avatar");
    
    if (contentEl) contentEl.value = "";
    if (usernameEl) usernameEl.value = "";
    if (avatarEl) avatarEl.value = "";
    embeds = [];
    renderAllEmbeds();
    /* ************************************************** */
  }
  
  multiMessageMode = !multiMessageMode;
  const queuePanel = document.getElementById("queuePanel");
  const multiModeBtn = document.getElementById("multiModeToggle");
  const sendBtn = document.getElementById("sendBtn");
  const webhookUrlSection = document.getElementById("webhookUrlSection");
  const webhookUrl = document.getElementById("webhookUrl");
  const queueWebhookUrl = document.getElementById("queueWebhookUrl");
  
  if (!queuePanel || !multiModeBtn || !sendBtn) {
    console.error("Elementos necessários não encontrados no DOM");
    return;
  }
  
  if (multiMessageMode) {
    // Ativa modo grupo - botão fica AZUL
    queuePanel.style.display = "block";
    multiModeBtn.classList.remove("btn-outline-info");
    multiModeBtn.classList.add("btn-info");
    sendBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${t('queuePanel.addToQueue')}`;
    sendBtn.classList.remove("btn-success");
    sendBtn.classList.add("btn-primary");
    sendBtn.onclick = addToQueue;
    
    // Oculta webhook URL das configurações e sincroniza com o grupo
    if (webhookUrlSection) webhookUrlSection.style.display = "none";
    if (queueWebhookUrl && webhookUrl) {
      queueWebhookUrl.value = webhookUrl.value;
    }
  } else {
    // Desativa modo grupo - botão fica VERDE
    queuePanel.style.display = "none";
    multiModeBtn.classList.remove("btn-info");
    multiModeBtn.classList.add("btn-outline-info");
    sendBtn.innerHTML = `<i class="bi bi-send"></i> ${t('editor.sendWebhook')}`;
    sendBtn.classList.remove("btn-primary");
    sendBtn.classList.add("btn-success");
    sendBtn.onclick = sendWebhook;
    
    // Mostra webhook URL nas configurações e sincroniza do grupo
    if (webhookUrlSection) webhookUrlSection.style.display = "block";
    if (queueWebhookUrl && webhookUrl) {
      webhookUrl.value = queueWebhookUrl.value;
    }
  }
  
  // Atualiza a UI dos botões de edição após alternar o modo
  updateEditingUI();
  
  // Mostra feedback se estava editando
  // (feedback visual já é dado pelo reset do formulário)
  // if (wasEditing) {
  //   console.log(t('messages.editCanceled'));
  // }
}

function getCurrentMessageData() {
  const contentEl = document.getElementById("content");
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  
  return {
    id: Date.now(),
    content: contentEl ? contentEl.value : "",
    username: usernameEl ? usernameEl.value : "",
    avatarUrl: avatarEl ? avatarEl.value : "",
    embeds: JSON.parse(JSON.stringify(embeds)) // Deep copy
  };
}

function addToQueue() {
  const messageData = getCurrentMessageData();
  
  // Valida se há conteúdo
  const hasContent = messageData.content.trim() !== "";
  const hasEmbeds = messageData.embeds.length > 0;
  
  if (!hasContent && !hasEmbeds) {
    alert(i18n.t('messages.addContentFirst'));
    return;
  }
  
  const btn = document.getElementById("sendBtn");
  let feedbackText = '';
  
  // Verifica se está editando uma mensagem existente
  if (editingMessageIndex !== null) {
    // Atualiza a mensagem na posição original
    messageQueue[editingMessageIndex] = messageData;
    feedbackText = `<i class="bi bi-check-lg"></i> ${t('messages.editSaved')}`;
    editingMessageIndex = null;
    updateEditingUI();
  } else {
    // Adiciona nova mensagem
    messageQueue.push(messageData);
    feedbackText = `<i class="bi bi-check-lg"></i> ${t('messages.added')}`;
  }
  
  updateQueueUI();
  
  // Limpa o formulário para próxima mensagem
  const contentEl = document.getElementById("content");
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  
  if (contentEl) contentEl.value = "";
  if (usernameEl) usernameEl.value = "";
  if (avatarEl) avatarEl.value = "";
  embeds = [];
  renderAllEmbeds();
  
  // Feedback visual (azul escuro temporário, depois volta para azul normal)
  if (!btn) return;
  
  const originalText = btn.innerHTML;
  const originalClass = btn.className;
  const originalStyle = btn.style.cssText;
  
  btn.innerHTML = feedbackText;
  btn.className = 'btn btn-primary btn-lg'; // Mantém azul
  btn.style.cssText = 'filter: brightness(0.75); transition: all 0.15s ease;'; // Escurece
  
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.className = originalClass;
    btn.style.cssText = originalStyle; // Volta para azul normal
  }, 1000);
}

function updateQueueUI() {
  const container = document.getElementById("queueContainer");
  const count = document.getElementById("queueCount");
  
  if (!container || !count) {
    console.error("Elementos do grupo não encontrados no DOM");
    return;
  }
  
  count.textContent = messageQueue.length;
  
  if (messageQueue.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = messageQueue.map((msg, index) => {
    const preview = getMessagePreview(msg);
    const isFirst = index === 0;
    const isLast = index === messageQueue.length - 1;
    const isEditing = editingMessageIndex === index;
    const editingClass = isEditing ? ' editing-message' : '';
    const editingBadge = isEditing ? `<span class="badge bg-warning text-dark ms-2"><i class="bi bi-pencil-fill"></i> ${t('messages.editing')}</span>` : '';
    
    return `
      <div class="queue-item card mb-2${editingClass}" data-index="${index}" draggable="false">
        <div class="card-body p-2 d-flex align-items-center gap-2">
          <button class="btn btn-sm btn-light queue-drag-handle" title="${t('queue.drag')}">
            <i class="bi bi-grip-vertical"></i>
          </button>
          <div class="flex-grow-1 min-width-0">
            <div class="d-flex align-items-center mb-1">
              <span class="badge bg-primary me-2">#${index + 1}</span>
              ${msg.username ? `<strong class="text-truncate">${escapeHtml(msg.username)}</strong>` : `<span class="text-muted">${t('queue.username')}</span>`}
              ${editingBadge}
            </div>
            <small class="text-muted d-block text-truncate">${preview}</small>
          </div>
          <div class="d-flex gap-1">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-secondary" onclick="moveQueueUp(${index})" ${isFirst ? 'disabled' : ''} title="${t('queue.moveUp')}">
                <i class="bi bi-arrow-up"></i>
              </button>
              <button class="btn btn-outline-secondary" onclick="moveQueueDown(${index})" ${isLast ? 'disabled' : ''} title="${t('queue.moveDown')}">
                <i class="bi bi-arrow-down"></i>
              </button>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="loadFromQueue(${index})" title="${t('queue.edit')}" ${isEditing ? 'disabled' : ''}>
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-info" onclick="duplicateInQueue(${index})" title="${t('queue.duplicate')}">
                <i class="bi bi-files"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="removeFromQueue(${index})" title="${t('queue.remove')}">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Inicializa drag-and-drop para o grupo
  initQueueDragAndDrop();
}

function getMessagePreview(msg) {
  const parts = [];
  
  if (msg.content) {
    parts.push(msg.content.substring(0, 50));
  }
  
  if (msg.embeds && msg.embeds.length > 0) {
    parts.push(`${msg.embeds.length} ${t('queue.embeds')}`);
  }
  
  return parts.join(' • ') || t('queue.noEmbeds');
}

function loadFromQueue(index) {
  const msg = messageQueue[index];
  if (!msg) return;
  
  const contentEl = document.getElementById("content");
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  
  if (contentEl) contentEl.value = msg.content || "";
  if (usernameEl) usernameEl.value = msg.username || "";
  if (avatarEl) avatarEl.value = msg.avatarUrl || "";
  
  embeds = JSON.parse(JSON.stringify(msg.embeds));
  renderAllEmbeds();
  
  // Entra no modo de edição (não remove do grupo)
  editingMessageIndex = index;
  updateEditingUI();
  updateQueueUI();
  
  // Scroll para o topo para ver o formulário
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function duplicateInQueue(index) {
  const msg = messageQueue[index];
  if (!msg) return;
  
  const duplicate = {
    ...msg,
    id: Date.now(),
    embeds: JSON.parse(JSON.stringify(msg.embeds))
  };
  
  messageQueue.splice(index + 1, 0, duplicate);
  
  // Se está editando uma mensagem após o ponto de duplicação, ajusta o índice
  if (editingMessageIndex !== null && editingMessageIndex > index) {
    editingMessageIndex++;
  }
  
  updateQueueUI();
}

function removeFromQueue(index) {
  // Se está removendo a mensagem sendo editada, cancela a edição
  if (editingMessageIndex === index) {
    editingMessageIndex = null;
    updateEditingUI();
  } else if (editingMessageIndex !== null && editingMessageIndex > index) {
    // Se removeu uma mensagem antes da que está sendo editada, ajusta o índice
    editingMessageIndex--;
  }
  
  messageQueue.splice(index, 1);
  updateQueueUI();
}

function clearQueue() {
  if (messageQueue.length === 0) return;
  
  if (confirm(i18n.t('messages.confirmClearQueue', { count: messageQueue.length }))) {
    messageQueue = [];
    editingMessageIndex = null; // Cancela edição se houver
    updateEditingUI();
    updateQueueUI();
  }
}

function updateEditingUI() {
  const sendBtn = document.getElementById("sendBtn");
  const addToQueueBtn = document.getElementById("addToQueueBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  
  if (!sendBtn) return;
  
  if (editingMessageIndex !== null) {
    // Modo edição ativo
    sendBtn.innerHTML = `<i class="bi bi-save"></i> ${t('editor.saveEdit')}`;
    
    // Transforma o botão de adicionar em cancelar edição (botão pequeno no header)
    if (addToQueueBtn) {
      addToQueueBtn.innerHTML = `<i class="bi bi-x-lg"></i> ${t('editor.cancelEdit')}`;
      addToQueueBtn.className = 'btn btn-sm btn-outline-warning';
      addToQueueBtn.onclick = cancelEdit;
    }
    
    // Mostra o botão de cancelar edição ao lado do salvar (botão grande)
    if (cancelEditBtn) {
      cancelEditBtn.style.display = 'block';
      cancelEditBtn.onclick = cancelEdit;
    }
  } else {
    // Modo normal - Verifica se está em modo múltiplo ou não
    if (multiMessageMode) {
      sendBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${t('queuePanel.addToQueue')}`;
      sendBtn.classList.remove("btn-success");
      sendBtn.classList.add("btn-primary");
      sendBtn.onclick = addToQueue;
    } else {
      sendBtn.innerHTML = `<i class="bi bi-send"></i> ${t('editor.sendWebhook')}`;
      sendBtn.classList.remove("btn-primary");
      sendBtn.classList.add("btn-success");
      sendBtn.onclick = sendWebhook;
    }
    
    // Restaura o botão de adicionar ao grupo
    if (addToQueueBtn) {
      addToQueueBtn.innerHTML = `<i class="bi bi-plus-lg"></i> ${t('queuePanel.addToQueue')}`;
      addToQueueBtn.className = 'btn btn-sm btn-outline-primary';
      addToQueueBtn.onclick = addToQueue;
    }
    
    // Esconde o botão de cancelar edição
    if (cancelEditBtn) {
      cancelEditBtn.style.display = 'none';
    }
  }
}

function cancelEdit() {
  if (editingMessageIndex === null) return;
  
  // Pergunta confirmação se há conteúdo no formulário
  const contentEl = document.getElementById("content");
  const hasContent = contentEl && contentEl.value.trim() !== "";
  const hasEmbeds = embeds.length > 0;
  
  if ((hasContent || hasEmbeds) && !confirm(t('editor.discardChanges'))) {
    return;
  }
  
  // Limpa o formulário
  const usernameEl = document.getElementById("username");
  const avatarEl = document.getElementById("avatar");
  
  if (contentEl) contentEl.value = "";
  if (usernameEl) usernameEl.value = "";
  if (avatarEl) avatarEl.value = "";
  embeds = [];
  renderAllEmbeds();
  
  // Sai do modo edição
  editingMessageIndex = null;
  updateEditingUI();
  updateQueueUI();
}

function moveQueueUp(index) {
  if (index === 0) return;
  
  const temp = messageQueue[index];
  messageQueue[index] = messageQueue[index - 1];
  messageQueue[index - 1] = temp;
  
  updateQueueUI();
}

function moveQueueDown(index) {
  if (index === messageQueue.length - 1) return;
  
  const temp = messageQueue[index];
  messageQueue[index] = messageQueue[index + 1];
  messageQueue[index + 1] = temp;
  
  updateQueueUI();
}

function moveEmbedUp(index) {
  if (index === 0) return;
  
  const temp = embeds[index];
  embeds[index] = embeds[index - 1];
  embeds[index - 1] = temp;
  
  renderAllEmbeds();
}

function moveEmbedDown(index) {
  if (index === embeds.length - 1) return;
  
  const temp = embeds[index];
  embeds[index] = embeds[index + 1];
  embeds[index + 1] = temp;
  
  renderAllEmbeds();
}

function moveFieldUp(embedIndex, fieldIndex) {
  if (fieldIndex === 0) return;
  
  const embed = embeds[embedIndex];
  const temp = embed.fields[fieldIndex];
  embed.fields[fieldIndex] = embed.fields[fieldIndex - 1];
  embed.fields[fieldIndex - 1] = temp;
  
  renderAllEmbeds();
}

function moveFieldDown(embedIndex, fieldIndex) {
  const embed = embeds[embedIndex];
  if (fieldIndex === embed.fields.length - 1) return;
  
  const temp = embed.fields[fieldIndex];
  embed.fields[fieldIndex] = embed.fields[fieldIndex + 1];
  embed.fields[fieldIndex + 1] = temp;
  
  renderAllEmbeds();
}

function initQueueDragAndDrop() {
  const container = document.getElementById("queueContainer");
  if (!container) return;
  
  const items = container.querySelectorAll(".queue-item");
  if (!items || items.length === 0) return;
  
  let draggedItem = null;
  let draggedIndex = null;
  
  items.forEach((item, index) => {
    const handle = item.querySelector(".queue-drag-handle");
    if (!handle) return;
    
    // Eventos de drag iniciados pelo handle
    handle.addEventListener("mousedown", () => {
      item.setAttribute("draggable", "true");
    });
    
    handle.addEventListener("mouseup", () => {
      item.setAttribute("draggable", "false");
    });
    
    item.addEventListener("dragstart", (e) => {
      draggedItem = item;
      draggedIndex = parseInt(item.dataset.index);
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
      items.forEach(i => {
        i.classList.remove("drop-target-above", "drop-target-below");
      });
      item.setAttribute("draggable", "false");
    });
    
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (draggedItem === item) return;
      
      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      
      items.forEach(i => {
        i.classList.remove("drop-target-above", "drop-target-below");
      });
      
      if (e.clientY < midpoint) {
        item.classList.add("drop-target-above");
      } else {
        item.classList.add("drop-target-below");
      }
    });
    
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (draggedItem === item) return;
      
      const targetIndex = parseInt(item.dataset.index);
      const rect = item.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      
      let newIndex;
      if (e.clientY < midpoint) {
        newIndex = targetIndex;
      } else {
        newIndex = targetIndex + 1;
      }
      
      // Ajusta se estiver movendo para baixo
      if (draggedIndex < newIndex) {
        newIndex--;
      }
      
      // Move o item no grupo
      const movedItem = messageQueue.splice(draggedIndex, 1)[0];
      messageQueue.splice(newIndex, 0, movedItem);
      
      updateQueueUI();
    });
    
    item.addEventListener("dragleave", () => {
      item.classList.remove("drop-target-above", "drop-target-below");
    });
  });
}

async function sendAllMessages() {
  // Cancela edição se houver alguma em andamento
  if (editingMessageIndex !== null) {
    editingMessageIndex = null;
    updateEditingUI();
    updateQueueUI();
  }
  
  // Pega a URL do campo específico do painel de grupo
  const queueWebhookUrlEl = document.getElementById("queueWebhookUrl");
  const url = queueWebhookUrlEl ? queueWebhookUrlEl.value.trim() : "";
  
  if (!url) {
    alert(t('messages.webhookRequired'));
    return;
  }
  
  if (messageQueue.length === 0) {
    alert(t('messages.noMessagesInQueue'));
    return;
  }
  
  const totalMessages = messageQueue.length;
  const progressDiv = document.getElementById("queueProgress");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const sendAllBtn = document.getElementById("sendAllBtn");
  
  if (!progressDiv || !progressBar || !progressText || !sendAllBtn) {
    console.error("Elementos de progresso não encontrados");
    return;
  }
  
  // Prepara UI
  progressDiv.style.display = "block";
  sendAllBtn.disabled = true;
  
  let sent = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < messageQueue.length; i++) {
    const msg = messageQueue[i];
    
    // Atualiza progresso
    progressText.textContent = `${i + 1}/${totalMessages}`;
    progressBar.style.width = `${((i + 1) / totalMessages) * 100}%`;
    
    try {
      // Constroi payload específico desta mensagem
      const payload = buildPayloadFromMessage(msg);
      
      const res = await fetch('/send-webhook', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, payload })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        sent++;
      } else {
        failed++;
        errors.push(t('messages.messageError', { number: i + 1, error: data.error }));
      }
      
    } catch (err) {
      failed++;
      errors.push(t('messages.messageError', { number: i + 1, error: err.message }));
    }
    
    // Delay entre mensagens (500ms)
    if (i < messageQueue.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Reseta UI (mantém as mensagens no grupo)
  progressDiv.style.display = "none";
  sendAllBtn.disabled = false;
  progressBar.style.width = "0%";
  
  // Relatório final
  let report = t('messages.messagesSentSuccess', { count: sent });
  if (failed > 0) {
    report += `\n${t('messages.messagesFailed', { count: failed })}`;
    if (errors.length > 0) {
      report += `\n\n${t('messages.errors')}\n${errors.slice(0, 5).join('\n')}`;
      if (errors.length > 5) {
        report += `\n${t('messages.andMoreErrors', { count: errors.length - 5 })}`;
      }
    }
  }
  
  alert(report);
}

function buildPayloadFromMessage(msg) {
  const payload = {};
  
  if (msg.content && msg.content.trim() !== "") {
    payload.content = msg.content;
  }
  
  if (msg.username) {
    payload.username = msg.username;
  }
  
  if (msg.avatarUrl) {
    payload.avatar_url = msg.avatarUrl;
  }
  
  if (msg.embeds && msg.embeds.length > 0) {
    payload.embeds = msg.embeds.map(embed => {
      const e = {};
      
      if (embed.title) e.title = embed.title;
      if (embed.description) e.description = embed.description;
      if (embed.url) e.url = embed.url;
      if (embed.color) {
        e.color = parseInt(embed.color.replace("#", ""), 16);
      }
      
      if (embed.authorName) {
        e.author = { name: embed.authorName };
        if (embed.authorUrl) e.author.url = embed.authorUrl;
        if (embed.authorIcon) e.author.icon_url = embed.authorIcon;
      }
      
      if (embed.thumbnailUrl) {
        e.thumbnail = { url: embed.thumbnailUrl };
      }
      
      if (embed.imageUrl) {
        e.image = { url: embed.imageUrl };
      }
      
      if (embed.footerText) {
        e.footer = { text: embed.footerText };
        if (embed.footerIcon) e.footer.icon_url = embed.footerIcon;
      }
      
      if (embed.timestamp) {
        e.timestamp = new Date().toISOString();
      }
      
      if (embed.fields && embed.fields.length > 0) {
        e.fields = embed.fields.filter(f => f.name && f.value);
      }
      
      return e;
    });
  }
  
  if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
    payload.content = "\u200B";
  }
  
  return payload;
}

// ========== FIM DAS FUNÇÕES DO MODO MÚLTIPLAS MENSAGENS ==========

async function sendWebhook() {
  const url = document.getElementById("webhookUrl").value.trim();
  if (!url) return alert(i18n.t('messages.invalidWebhookUrl'));

  const payload = buildPayload();
  if (!payload) return;

  console.log("Enviando payload:", payload);

  try {
    // Envia através do servidor proxy para evitar problemas de CORS
    const res = await fetch('/send-webhook', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, payload })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      alert(i18n.t('messages.webhookSent'));
    } else {
      console.error(data.error);
      alert(i18n.t('messages.webhookError', { error: data.error }));
    }
  } catch (err) {
    console.error(err);
    alert(i18n.t('messages.webhookError', { error: err.message }));
  }
}

// Carrega dados de um JSON importado
function loadFromJson(json) {
  // Carrega campos principais
  document.getElementById("content").value = json.content || "";
  document.getElementById("username").value = json.username || "";
  document.getElementById("avatar").value = json.avatar_url || "";

  // Limpa embeds anteriores
  embeds = [];

  // Carrega embeds do JSON
  if (json.embeds && Array.isArray(json.embeds)) {
    json.embeds.forEach(e => {
      const embed = {
        title: e.title || "",
        description: e.description || "",
        url: e.url || "",
        color: "#5865F2",
        authorName: "",
        authorUrl: "",
        authorIcon: "",
        thumbnailUrl: "",
        imageUrl: "",
        footerText: "",
        footerIcon: "",
        timestamp: false,
        fields: []
      };

      // Converte cor de decimal para hex
      if (e.color) {
        embed.color = "#" + e.color.toString(16).padStart(6, "0");
      }

      // Author
      if (e.author) {
        embed.authorName = e.author.name || "";
        embed.authorUrl = e.author.url || "";
        embed.authorIcon = e.author.icon_url || "";
      }

      // Imagens
      if (e.thumbnail) {
        embed.thumbnailUrl = e.thumbnail.url || "";
      }

      if (e.image) {
        embed.imageUrl = e.image.url || "";
      }

      // Footer
      if (e.footer) {
        embed.footerText = e.footer.text || "";
        embed.footerIcon = e.footer.icon_url || "";
      }

      // Timestamp
      if (e.timestamp) {
        embed.timestamp = true;
      }

      // Fields
      if (e.fields && Array.isArray(e.fields)) {
        embed.fields = e.fields.map(f => ({
          name: f.name || "",
          value: f.value || "",
          inline: !!f.inline
        }));
      }

      embeds.push(embed);
    });
  }

  // Re-renderiza tudo
  renderAllEmbeds();
}

// Converte embeds do formato interno para o formato do Discord
function convertEmbedsToPayload(embedsArray) {
  return embedsArray.map(e => {
    const embed = {};

    // Adiciona campos básicos
    if (e.title) embed.title = e.title;
    if (e.description) embed.description = e.description;
    if (e.url) embed.url = e.url;

    // Converte cor de hex para decimal
    if (e.color) {
      const colorHex = e.color.replace("#", "");
      const colorDecimal = parseInt(colorHex, 16);
      if (!isNaN(colorDecimal)) {
        embed.color = colorDecimal;
      }
    }

    // Author
    if (e.authorName) {
      embed.author = { name: e.authorName };
      if (e.authorUrl) embed.author.url = e.authorUrl;
      if (e.authorIcon) embed.author.icon_url = e.authorIcon;
    }

    // Imagens
    if (e.thumbnailUrl) {
      embed.thumbnail = { url: e.thumbnailUrl };
    }

    if (e.imageUrl) {
      embed.image = { url: e.imageUrl };
    }

    // Footer
    if (e.footerText) {
      embed.footer = { text: e.footerText };
      if (e.footerIcon) embed.footer.icon_url = e.footerIcon;
    }

    // Timestamp
    if (e.timestamp) {
      embed.timestamp = new Date().toISOString();
    }

    // Fields - filtra apenas os que têm nome E valor
    if (e.fields && e.fields.length > 0) {
      const validFields = e.fields
        .filter(f => f.name && f.value)
        .map(f => ({
          name: f.name,
          value: f.value,
          inline: !!f.inline
        }));

      if (validFields.length > 0) {
        embed.fields = validFields;
      }
    }

    // Retorna null se o embed estiver vazio
    if (Object.keys(embed).length === 0) {
      return null;
    }

    // Adiciona o tipo
    embed.type = "rich";
    return embed;
  }).filter(Boolean); // Remove embeds nulos
}

// Detecta o formato do JSON e faz a importação apropriada
function handleJsonImport(parsed) {
  // Detecta se é formato novo (com mode) ou formato antigo
  if (parsed.mode === "multi") {
    // Importa grupo de mensagens
    importMultipleMessages(parsed.messages);
  } else if (parsed.mode === "single") {
    // Importa mensagem única
    importSingleMessage(parsed.message);
  } else if (parsed.messages && Array.isArray(parsed.messages)) {
    // Formato antigo de múltiplas mensagens (sem mode)
    importMultipleMessages(parsed.messages);
  } else {
    // Formato antigo de mensagem única (payload direto)
    importSingleMessage(parsed);
  }
}

// Importa uma única mensagem
function importSingleMessage(messageData) {
  if (multiMessageMode) {
    // Está no modo múltiplo: perguntar se quer adicionar ao grupo
    const action = confirm(t('messages.confirmMultiModeImport'));
    
    if (action) {
      // Adiciona ao grupo
      const msg = convertPayloadToMessage(messageData);
      messageQueue.push(msg);
      updateQueueUI();
      alert(t('messages.messageAddedToQueue'));
    } else {
      // Carrega no editor
      loadFromJson(messageData);
      alert(t('messages.messageLoadedInEditor'));
    }
  } else {
    // Modo único: carrega no editor
    loadFromJson(messageData);
    alert(t('messages.jsonImportedSuccess'));
  }
}

// Importa múltiplas mensagens
function importMultipleMessages(messagesArray) {
  if (!Array.isArray(messagesArray) || messagesArray.length === 0) {
    alert(t('messages.noMessagesInFile'));
    return;
  }
  
  if (!multiMessageMode) {
    // Está no modo único: perguntar se quer ativar modo múltiplo
    const switchMode = confirm(t('messages.confirmSwitchToMultiMode', { count: messagesArray.length }));
    
    if (switchMode) {
      // Ativa modo múltiplo
      if (!ENABLE_MULTI_MESSAGE_MODE) {
        alert(t('messages.multiModeDisabled'));
        return;
      }
      toggleMultiMessageMode();
    } else {
      // Carrega apenas a primeira mensagem
      loadFromJson(messagesArray[0]);
      alert(t('messages.firstMessageImported'));
      return;
    }
  }
  
  // Está no modo múltiplo: perguntar se quer substituir ou adicionar
  let action = "replace";
  if (messageQueue.length > 0) {
    action = confirm(t('messages.confirmReplaceQueue', { count: messageQueue.length })) ? "replace" : "add";
  }
  
  if (action === "replace") {
    messageQueue = [];
  }
  
  // Converte e adiciona as mensagens
  messagesArray.forEach(msgData => {
    const msg = convertPayloadToMessage(msgData);
    messageQueue.push(msg);
  });
  
  updateQueueUI();
  const actionText = action === "replace" ? t('messages.imported') : t('messages.addedToQueue');
  alert(t('messages.messagesImported', { count: messagesArray.length, action: actionText }));
}

// Converte um payload do Discord para o formato interno de mensagem
function convertPayloadToMessage(payload) {
  const msg = {
    id: Date.now() + Math.random(), // ID único
    content: payload.content || "",
    username: payload.username || "",
    avatarUrl: payload.avatar_url || "",
    embeds: []
  };
  
  // Converte embeds
  if (payload.embeds && Array.isArray(payload.embeds)) {
    msg.embeds = payload.embeds.map(e => {
      const embed = {
        title: e.title || "",
        description: e.description || "",
        url: e.url || "",
        color: "#5865F2",
        authorName: "",
        authorUrl: "",
        authorIcon: "",
        thumbnailUrl: "",
        imageUrl: "",
        footerText: "",
        footerIcon: "",
        timestamp: false,
        fields: []
      };

      // Converte cor de decimal para hex
      if (e.color) {
        embed.color = "#" + e.color.toString(16).padStart(6, "0");
      }

      // Author
      if (e.author) {
        embed.authorName = e.author.name || "";
        embed.authorUrl = e.author.url || "";
        embed.authorIcon = e.author.icon_url || "";
      }

      // Imagens
      if (e.thumbnail) {
        embed.thumbnailUrl = e.thumbnail.url || "";
      }

      if (e.image) {
        embed.imageUrl = e.image.url || "";
      }

      // Footer
      if (e.footer) {
        embed.footerText = e.footer.text || "";
        embed.footerIcon = e.footer.icon_url || "";
      }

      // Timestamp
      if (e.timestamp) {
        embed.timestamp = true;
      }

      // Fields
      if (e.fields && Array.isArray(e.fields)) {
        embed.fields = e.fields.map(f => ({
          name: f.name || "",
          value: f.value || "",
          inline: !!f.inline
        }));
      }

      return embed;
    });
  }
  
  return msg;
}

// Inicialização da aplicação
// Aguarda os Discord Components carregarem antes de renderizar o preview
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  // Aguarda um pouco para garantir que os componentes foram registrados
  setTimeout(() => {
    updatePreview();
  }, 100);
  
  // Inicializa o modo múltiplas mensagens se estiver habilitado
  if (ENABLE_MULTI_MESSAGE_MODE) {
    initMultiMessageMode();
  }
}

function initMultiMessageMode() {
  // Oculta o painel de grupo por padrão
  const queuePanel = document.getElementById("queuePanel");
  if (queuePanel) {
    queuePanel.style.display = "none";
  }
  
  // Garante que o estado inicial está correto
  multiMessageMode = false;
  messageQueue = [];
  
  console.log("Modo múltiplas mensagens: HABILITADO");
}
