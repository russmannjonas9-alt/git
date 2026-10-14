/**
 * MERCEDES-BENZ 230 SL PAGODA (W113) - RESTORATION DASHBOARD
 * Visor de Láminas Técnicas de Despiece, Pines Interactivos & Control de Repuestos
 */

(function () {
  'use strict';

  // ================= ESTADO DE LA APLICACIÓN =================
  const STORAGE_KEY_PARTS = 'pagoda_230sl_parts_v1';
  const STORAGE_KEY_META = 'pagoda_230sl_meta_v1';

  let parts = [];
  let vehicleMeta = {
    vin: '113.042-10-XXXXXX',
    owner: 'Cliente Taller'
  };

  let activePlateIndex = 0;
  let activeSelectedPin = null;
  let currentStatus = 'all';
  let currentPriority = 'all';
  let currentGroup = 'all';
  let searchQuery = '';

  // ================= INICIALIZACIÓN =================
  function init() {
    loadData();
    setupMetaInputs();
    setupPlatesViewer();
    setupFiltersAndSearch();
    setupModals();
    setupExportButtons();
    renderGroupSelect();
    render();
  }

  function loadData() {
    try {
      const savedParts = localStorage.getItem(STORAGE_KEY_PARTS);
      if (savedParts) {
        parts = JSON.parse(savedParts);
      } else if (typeof INITIAL_PARTS_DATA !== 'undefined') {
        parts = JSON.parse(JSON.stringify(INITIAL_PARTS_DATA));
        saveData();
      } else {
        parts = [];
      }

      const savedMeta = localStorage.getItem(STORAGE_KEY_META);
      if (savedMeta) {
        vehicleMeta = JSON.parse(savedMeta);
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
      parts = typeof INITIAL_PARTS_DATA !== 'undefined' ? INITIAL_PARTS_DATA : [];
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY_PARTS, JSON.stringify(parts));
    } catch (e) {
      console.error('Error guardando repuestos:', e);
    }
  }

  function saveMeta() {
    try {
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(vehicleMeta));
    } catch (e) {
      console.error('Error guardando metadata:', e);
    }
  }

  function setupMetaInputs() {
    const vinInput = document.getElementById('vinInput');
    const ownerInput = document.getElementById('ownerInput');

    if (vinInput) {
      vinInput.value = vehicleMeta.vin || '';
      vinInput.addEventListener('input', (e) => {
        vehicleMeta.vin = e.target.value;
        saveMeta();
      });
    }

    if (ownerInput) {
      ownerInput.value = vehicleMeta.owner || '';
      ownerInput.addEventListener('input', (e) => {
        vehicleMeta.owner = e.target.value;
        saveMeta();
      });
    }
  }

  // ================= VISOR DE LÁMINAS TÉCNICAS =================
  function setupPlatesViewer() {
    renderPlateTabs();
    renderActivePlate();

    // Botón de Zoom Pantalla Completa
    const btnZoom = document.getElementById('btnToggleZoom');
    const frame = document.getElementById('plateCanvasFrame');
    if (btnZoom && frame) {
      btnZoom.addEventListener('click', () => {
        frame.classList.toggle('is-zoomed');
        btnZoom.innerHTML = frame.classList.contains('is-zoomed')
          ? '<i class="bi bi-fullscreen-exit"></i> Reducir Lámina'
          : '<i class="bi bi-arrows-fullscreen"></i> Ampliar Lámina';
      });
    }
  }

  function renderPlateTabs() {
    const container = document.getElementById('platesTabsContainer');
    if (!container || typeof TECHNICAL_PLATES === 'undefined') return;

    container.innerHTML = '';
    TECHNICAL_PLATES.forEach((plate, idx) => {
      // Contar piezas faltantes en esta lámina
      const missingCount = plate.pins.filter(pin => {
        const part = parts.find(p => p.id === pin.partId);
        return part && part.status === 'missing';
      }).length;

      const btn = document.createElement('button');
      btn.className = `plate-tab-btn ${idx === activePlateIndex ? 'active' : ''}`;
      btn.innerHTML = `
        <i class="bi bi-card-image"></i>
        <span>${escapeHtml(plate.name)}</span>
        ${missingCount > 0 ? `<span class="plate-tab-badge text-danger">${missingCount} faltan</span>` : '<span class="plate-tab-badge text-success">OK</span>'}
      `;

      btn.addEventListener('click', () => {
        activePlateIndex = idx;
        activeSelectedPin = null;
        renderPlateTabs();
        renderActivePlate();
      });

      container.appendChild(btn);
    });
  }

  function renderActivePlate() {
    if (typeof TECHNICAL_PLATES === 'undefined') return;
    const plate = TECHNICAL_PLATES[activePlateIndex];
    if (!plate) return;

    // Actualizar encabezados
    const titleEl = document.getElementById('activePlateTitle');
    const subEl = document.getElementById('activePlateSubtitle');
    const imgEl = document.getElementById('activePlateImage');
    const missingBadge = document.getElementById('plateMissingCount');
    const footer = document.getElementById('plateInspectorFooter');

    if (titleEl) titleEl.textContent = plate.title;
    if (subEl) subEl.textContent = plate.subtitle;
    if (imgEl) imgEl.src = plate.image;

    // Conteo faltantes en la lámina
    const missingInPlate = plate.pins.filter(pin => {
      const part = parts.find(p => p.id === pin.partId);
      return part && part.status === 'missing';
    }).length;
    if (missingBadge) missingBadge.textContent = missingInPlate;

    // Ocultar inspector si no hay pin seleccionado
    if (footer && !activeSelectedPin) footer.style.display = 'none';

    // Renderizar pines sobre la lámina
    renderPinsLayer(plate);
  }

  function renderPinsLayer(plate) {
    const layer = document.getElementById('pinsLayer');
    const tooltip = document.getElementById('plateTooltip');
    if (!layer) return;

    layer.innerHTML = '';
    plate.pins.forEach(pin => {
      const part = parts.find(p => p.id === pin.partId);
      const status = part ? part.status : 'missing';

      const pinEl = document.createElement('button');
      pinEl.className = `plate-pin pin-status-${status} ${activeSelectedPin && activeSelectedPin.id === pin.id ? 'pin-active' : ''}`;
      pinEl.style.left = `${pin.x}%`;
      pinEl.style.top = `${pin.y}%`;
      pinEl.innerHTML = `<span>${pin.label}</span>`;
      pinEl.title = pin.name;

      // Evento Hover -> Tooltip
      pinEl.addEventListener('mouseenter', (e) => {
        if (!tooltip) return;
        let badgeHtml = '<span class="tip-badge tip-missing">🔴 FALTA COMPRAR</span>';
        if (status === 'repair') badgeHtml = '<span class="tip-badge tip-repair">🟡 EN TALLER A REPARAR</span>';
        else if (status === 'ok') badgeHtml = '<span class="tip-badge tip-ok">🟢 EN TALLER OK</span>';

        tooltip.innerHTML = `
          <div class="tip-title">#${pin.label} - ${escapeHtml(part ? part.name : pin.name)}</div>
          <div class="tip-code">${part ? part.code : 'OEM Mercedes'}</div>
          <div>${badgeHtml}</div>
        `;
        tooltip.style.left = `${pin.x}%`;
        tooltip.style.top = `calc(${pin.y}% - 55px)`;
        tooltip.style.display = 'block';
      });

      pinEl.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });

      // Evento Clic -> Abrir Inspector de Pieza
      pinEl.addEventListener('click', (e) => {
        e.stopPropagation();
        activeSelectedPin = pin;
        openPlateInspector(pin, part);
        renderPinsLayer(plate);
      });

      layer.appendChild(pinEl);
    });
  }

  function openPlateInspector(pin, part) {
    const footer = document.getElementById('plateInspectorFooter');
    if (!footer) return;

    const calloutBadge = document.getElementById('inspCalloutNum');
    const nameEl = document.getElementById('inspItemName');
    const codeEl = document.getElementById('inspItemCode');
    const groupEl = document.getElementById('inspItemGroup');
    const descEl = document.getElementById('inspItemDesc');
    const btnSls = document.getElementById('inspBtnSls');
    const btnScroll = document.getElementById('inspBtnScrollList');

    if (calloutBadge) calloutBadge.textContent = pin.label;
    if (nameEl) nameEl.textContent = part ? part.name : pin.name;
    if (codeEl) codeEl.textContent = part ? part.code : 'OEM Mercedes W113';
    if (groupEl) groupEl.textContent = part ? part.group : 'Gr. 88';
    if (descEl) descEl.textContent = part ? (part.description || part.notes || '') : '';

    if (btnSls && part) {
      const cleanCode = encodeURIComponent(part.code.replace(/\s+/g, ' '));
      btnSls.href = part.supplierUrl || `https://www.sls-hh-shop.de/en/search?q=${cleanCode}`;
    }

    if (btnScroll && part) {
      btnScroll.onclick = () => {
        scrollToPartCard(part.id);
      };
    }

    // Botones de cambio rápido de estado en el inspector
    const btnMissing = document.getElementById('inspBtnMissing');
    const btnRepair = document.getElementById('inspBtnRepair');
    const btnOk = document.getElementById('inspBtnOk');

    const updateStatusPillStyles = (currentSt) => {
      if (btnMissing) btnMissing.classList.toggle('active-missing', currentSt === 'missing');
      if (btnRepair) btnRepair.classList.toggle('active-repair', currentSt === 'repair');
      if (btnOk) btnOk.classList.toggle('active-ok', currentSt === 'ok');
    };

    updateStatusPillStyles(part ? part.status : 'missing');

    const setupStatusClick = (btn, newStatus) => {
      btn.onclick = () => {
        if (!part) return;
        part.status = newStatus;
        saveData();
        updateStatusPillStyles(newStatus);
        renderPlateTabs();
        renderActivePlate();
        render();
        showToast(`Estado actualizado: ${part.name}`, 'info');
      };
    };

    if (btnMissing) setupStatusClick(btnMissing, 'missing');
    if (btnRepair) setupStatusClick(btnRepair, 'repair');
    if (btnOk) setupStatusClick(btnOk, 'ok');

    footer.style.display = 'flex';
  }

  function scrollToPartCard(partId) {
    if (currentStatus !== 'all') activateStatusFilter('all');
    if (currentGroup !== 'all') {
      currentGroup = 'all';
      const grpSelect = document.getElementById('groupFilterSelect');
      if (grpSelect) grpSelect.value = 'all';
      render();
    }

    setTimeout(() => {
      const targetCard = document.querySelector(`.part-card[data-id="${partId}"]`);
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetCard.classList.add('card-highlight-plate');
        setTimeout(() => targetCard.classList.remove('card-highlight-plate'), 3500);
      }
    }, 150);
  }

  // ================= BÚSQUEDA Y FILTROS =================
  function setupFiltersAndSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('btnClearSearch');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
        render();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        render();
      });
    }

    const statusBtns = document.querySelectorAll('#statusFilterGroup .filter-btn');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStatus = btn.dataset.status;
        render();
      });
    });

    const cardMissing = document.getElementById('cardFilterMissing');
    if (cardMissing) cardMissing.addEventListener('click', () => activateStatusFilter('missing'));

    const cardRepair = document.getElementById('cardFilterRepair');
    if (cardRepair) cardRepair.addEventListener('click', () => activateStatusFilter('repair'));

    const cardOk = document.getElementById('cardFilterOk');
    if (cardOk) cardOk.addEventListener('click', () => activateStatusFilter('ok'));

    const prioritySelect = document.getElementById('priorityFilterSelect');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        currentPriority = e.target.value;
        render();
      });
    }

    const groupSelect = document.getElementById('groupFilterSelect');
    if (groupSelect) {
      groupSelect.addEventListener('change', (e) => {
        currentGroup = e.target.value;
        render();
      });
    }

    const resetFiltersBtn = document.getElementById('btnResetFilters');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        if (clearBtn) clearBtn.style.display = 'none';
        currentStatus = 'all';
        currentPriority = 'all';
        currentGroup = 'all';

        if (prioritySelect) prioritySelect.value = 'all';
        if (groupSelect) groupSelect.value = 'all';
        activateStatusFilter('all');
      });
    }
  }

  function activateStatusFilter(status) {
    currentStatus = status;
    const statusBtns = document.querySelectorAll('#statusFilterGroup .filter-btn');
    statusBtns.forEach(btn => {
      if (btn.dataset.status === status) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    render();
  }

  function renderGroupSelect() {
    const groupSelect = document.getElementById('groupFilterSelect');
    if (!groupSelect) return;

    const uniqueGroups = Array.from(new Set(parts.map(p => p.group))).sort();
    groupSelect.innerHTML = '<option value="all">Todos los Grupos Mercedes</option>';
    uniqueGroups.forEach(grp => {
      const opt = document.createElement('option');
      opt.value = grp;
      const sample = parts.find(p => p.group === grp);
      opt.textContent = `${grp} - ${sample?.groupName || ''}`;
      groupSelect.appendChild(opt);
    });
  }

  // ================= RENDERIZADO PRINCIPAL =================
  function render() {
    updateStats();
    renderCards();
  }

  function updateStats() {
    const total = parts.length;
    const missing = parts.filter(p => p.status === 'missing');
    const repair = parts.filter(p => p.status === 'repair');
    const ok = parts.filter(p => p.status === 'ok');

    const missingHigh = missing.filter(p => p.priority === 'high').length;
    const progressPct = total > 0 ? Math.round((ok.length / total) * 100) : 0;

    const elTotal = document.getElementById('statTotal');
    const elMissing = document.getElementById('statMissing');
    const elMissingHigh = document.getElementById('statMissingHigh');
    const elRepair = document.getElementById('statRepair');
    const elOk = document.getElementById('statOk');
    const elProgressPct = document.getElementById('statProgressPct');
    const elProgressBar = document.getElementById('statProgressBar');
    const elProgressCount = document.getElementById('statProgressCount');

    if (elTotal) elTotal.textContent = total;
    if (elMissing) elMissing.textContent = missing.length;
    if (elMissingHigh) elMissingHigh.textContent = `${missingHigh} Urgentes`;
    if (elRepair) elRepair.textContent = repair.length;
    if (elOk) elOk.textContent = ok.length;
    if (elProgressPct) elProgressPct.textContent = `${progressPct}%`;
    if (elProgressBar) elProgressBar.style.width = `${progressPct}%`;
    if (elProgressCount) elProgressCount.textContent = `${ok.length} de ${total} OK`;
  }

  function renderCards() {
    const container = document.getElementById('partsContainer');
    const emptyState = document.getElementById('emptyState');
    const resultsCount = document.getElementById('resultsCount');
    if (!container) return;

    const filtered = parts.filter(part => {
      if (currentStatus !== 'all' && part.status !== currentStatus) return false;
      if (currentPriority !== 'all' && part.priority !== currentPriority) return false;
      if (currentGroup !== 'all' && part.group !== currentGroup) return false;
      if (searchQuery) {
        const text = `${part.code} ${part.name} ${part.description} ${part.group} ${part.groupName} ${part.notes || ''} ${part.location || ''}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    if (resultsCount) {
      resultsCount.innerHTML = `Mostrando <strong>${filtered.length}</strong> de ${parts.length} repuestos`;
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = '';
    filtered.forEach(part => {
      const card = createPartCard(part);
      container.appendChild(card);
    });
  }

  function createPartCard(part) {
    const card = document.createElement('div');
    card.className = `part-card card-status-${part.status}`;
    card.dataset.id = part.id;

    let priorityClass = 'priority-medium';
    let priorityLabel = 'Media';
    if (part.priority === 'high') {
      priorityClass = 'priority-high';
      priorityLabel = '🚨 Alta / Crítico';
    } else if (part.priority === 'low') {
      priorityClass = 'priority-low';
      priorityLabel = '🔹 Baja';
    }

    const cleanCodeForSearch = encodeURIComponent(part.code.replace(/\s+/g, ' '));
    const slsSearchUrl = part.supplierUrl || `https://www.sls-hh-shop.de/en/search?q=${cleanCodeForSearch}`;

    // Buscar si esta pieza está en alguna lámina técnica
    let associatedPlateIdx = -1;
    if (typeof TECHNICAL_PLATES !== 'undefined') {
      associatedPlateIdx = TECHNICAL_PLATES.findIndex(pl => pl.pins.some(pin => pin.partId === part.id));
    }

    card.innerHTML = `
      <div>
        <div class="card-header-row">
          <span class="card-group-badge">${part.group} • ${escapeHtml(part.groupName || '')}</span>
          <span class="card-priority-badge ${priorityClass}">${priorityLabel}</span>
        </div>

        <div class="card-code-box" style="margin-top: 0.6rem;">
          <span class="oem-code">${escapeHtml(part.code)}</span>
          <button class="btn-copy-code" title="Copiar código OEM al portapapeles" data-code="${escapeHtml(part.code)}">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>

        <div class="card-body" style="margin-top: 0.6rem;">
          <h4 class="part-name">${escapeHtml(part.name)}</h4>
          ${part.description ? `<p class="part-desc">${escapeHtml(part.description)}</p>` : ''}
          ${part.notes ? `<div class="part-notes"><i class="bi bi-pin-angle-fill"></i> ${escapeHtml(part.notes)}</div>` : ''}

          <div class="part-meta-line">
            <span class="meta-item"><i class="bi bi-hash"></i> Req: <strong>${part.qtyRequired || 1}</strong> | En taller: <strong>${part.qtyPresent || 0}</strong></span>
            ${part.location && part.location !== '-' ? `<span class="meta-item"><i class="bi bi-geo-alt-fill"></i> ${escapeHtml(part.location)}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Quick Status Switcher -->
      <div>
        <div class="card-status-switcher">
          <button class="status-opt-btn ${part.status === 'missing' ? 'active-missing' : ''}" data-status="missing" title="Marcar como Faltante para comprar">
            <i class="bi bi-exclamation-octagon-fill"></i> Falta Comprar
          </button>
          <button class="status-opt-btn ${part.status === 'repair' ? 'active-repair' : ''}" data-status="repair" title="Marcar para Reparar en taller">
            <i class="bi bi-tools"></i> A Reparar
          </button>
          <button class="status-opt-btn ${part.status === 'ok' ? 'active-ok' : ''}" data-status="ok" title="Marcar como Presente y en buen estado">
            <i class="bi bi-check-circle-fill"></i> OK
          </button>
        </div>

        <div class="card-actions-row">
          <a href="${slsSearchUrl}" target="_blank" class="sls-link-btn" title="Buscar despiece y foto en catálogo">
            <i class="bi bi-box-arrow-up-right"></i> SLS Hamburg
          </a>

          <div class="item-action-btns">
            ${associatedPlateIdx >= 0 ? `
              <button class="action-icon-btn btn-view-plate" title="Ver en Lámina de Despiece" data-plate="${associatedPlateIdx}">
                <i class="bi bi-card-image"></i>
              </button>
            ` : ''}
            <button class="action-icon-btn btn-edit" title="Editar detalles de la pieza">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="action-icon-btn btn-delete" title="Eliminar de la lista">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // Eventos
    const copyBtn = card.querySelector('.btn-copy-code');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(part.code).then(() => {
          showToast(`Código copiado: ${part.code}`, 'success');
        });
      });
    }

    const statusBtns = card.querySelectorAll('.status-opt-btn');
    statusBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newStatus = btn.dataset.status;
        if (part.status !== newStatus) {
          part.status = newStatus;
          saveData();
          renderPlateTabs();
          renderActivePlate();
          render();
          showToast(`Estado actualizado: ${part.name}`, 'info');
        }
      });
    });

    const viewPlateBtn = card.querySelector('.btn-view-plate');
    if (viewPlateBtn) {
      viewPlateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetPlate = parseInt(viewPlateBtn.dataset.plate, 10);
        activePlateIndex = targetPlate;
        renderPlateTabs();
        renderActivePlate();
        const viewerSection = document.querySelector('.plates-viewer-section');
        if (viewerSection) viewerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Seleccionar pin de esa pieza
        const plate = TECHNICAL_PLATES[targetPlate];
        const matchingPin = plate.pins.find(p => p.partId === part.id);
        if (matchingPin) {
          activeSelectedPin = matchingPin;
          openPlateInspector(matchingPin, part);
          renderPinsLayer(plate);
        }
      });
    }

    const editBtn = card.querySelector('.btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(part);
      });
    }

    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar "${part.name}" (${part.code}) de la lista de chequeo?`)) {
          parts = parts.filter(p => p.id !== part.id);
          saveData();
          renderPlateTabs();
          renderActivePlate();
          render();
          showToast('Pieza eliminada', 'info');
        }
      });
    }

    return card;
  }

  // ================= MODALS & FORMULARIOS =================
  function setupModals() {
    const partModal = document.getElementById('partModal');
    const btnNewPart = document.getElementById('btnNewPart');
    const btnClosePartModal = document.getElementById('btnClosePartModal');
    const btnCancelPartModal = document.getElementById('btnCancelPartModal');
    const partForm = document.getElementById('partForm');

    if (btnNewPart) btnNewPart.addEventListener('click', openNewPartModal);
    if (btnClosePartModal) btnClosePartModal.addEventListener('click', () => partModal.style.display = 'none');
    if (btnCancelPartModal) btnCancelPartModal.addEventListener('click', () => partModal.style.display = 'none');
    if (partForm) partForm.addEventListener('submit', handlePartFormSubmit);

    const reportModal = document.getElementById('reportModal');
    const btnOwnerReport = document.getElementById('btnOwnerReport');
    const btnCloseReportModal = document.getElementById('btnCloseReportModal');

    if (btnOwnerReport) {
      btnOwnerReport.addEventListener('click', () => {
        generateOwnerReport();
        reportModal.style.display = 'flex';
      });
    }
    if (btnCloseReportModal) btnCloseReportModal.addEventListener('click', () => reportModal.style.display = 'none');

    const manualModal = document.getElementById('manualModal');
    const btnOpenManualModal = document.getElementById('btnOpenManualModal');
    const btnCloseManualModal = document.getElementById('btnCloseManualModal');

    if (btnOpenManualModal) btnOpenManualModal.addEventListener('click', () => manualModal.style.display = 'flex');
    if (btnCloseManualModal) btnCloseManualModal.addEventListener('click', () => manualModal.style.display = 'none');

    window.addEventListener('click', (e) => {
      if (e.target === partModal) partModal.style.display = 'none';
      if (e.target === reportModal) reportModal.style.display = 'none';
      if (e.target === manualModal) manualModal.style.display = 'none';
    });
  }

  function openNewPartModal() {
    const partModal = document.getElementById('partModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('partForm');

    modalTitle.innerHTML = '<i class="bi bi-plus-circle"></i> Agregar Repuesto del Manual';
    form.reset();
    document.getElementById('formPartId').value = '';

    partModal.style.display = 'flex';
    document.getElementById('formCode').focus();
  }

  function openEditModal(part) {
    const partModal = document.getElementById('partModal');
    const modalTitle = document.getElementById('modalTitle');

    modalTitle.innerHTML = '<i class="bi bi-pencil-square"></i> Editar Repuesto';

    document.getElementById('formPartId').value = part.id;
    let cleanCode = part.code;
    if (cleanCode.startsWith('A ')) {
      cleanCode = cleanCode.substring(2);
    }
    document.getElementById('formCode').value = cleanCode;
    document.getElementById('formGroup').value = part.group;
    document.getElementById('formName').value = part.name;
    document.getElementById('formDescription').value = part.description || '';
    document.getElementById('formZone').value = part.zone;
    document.getElementById('formStatus').value = part.status;
    document.getElementById('formPriority').value = part.priority || 'medium';
    document.getElementById('formQtyReq').value = part.qtyRequired || 1;
    document.getElementById('formQtyPres').value = part.qtyPresent || 0;
    document.getElementById('formLocation').value = part.location || '';
    document.getElementById('formNotes').value = part.notes || '';

    partModal.style.display = 'flex';
  }

  function handlePartFormSubmit(e) {
    e.preventDefault();

    const partId = document.getElementById('formPartId').value;
    let rawCode = document.getElementById('formCode').value.trim();
    if (!rawCode.toUpperCase().startsWith('A ')) {
      rawCode = `A ${rawCode.toUpperCase()}`;
    }

    const group = document.getElementById('formGroup').value.trim();
    const name = document.getElementById('formName').value.trim();
    const description = document.getElementById('formDescription').value.trim();
    const zone = document.getElementById('formZone').value;
    const status = document.getElementById('formStatus').value;
    const priority = document.getElementById('formPriority').value;
    const qtyRequired = parseInt(document.getElementById('formQtyReq').value, 10) || 1;
    const qtyPresent = parseInt(document.getElementById('formQtyPres').value, 10) || 0;
    const location = document.getElementById('formLocation').value.trim();
    const notes = document.getElementById('formNotes').value.trim();

    if (partId) {
      const existing = parts.find(p => p.id === partId);
      if (existing) {
        existing.code = rawCode;
        existing.group = group;
        existing.name = name;
        existing.description = description;
        existing.zone = zone;
        existing.status = status;
        existing.priority = priority;
        existing.qtyRequired = qtyRequired;
        existing.qtyPresent = qtyPresent;
        existing.location = location;
        existing.notes = notes;
      }
      showToast('Repuesto modificado correctamente', 'success');
    } else {
      const newPart = {
        id: `part-${Date.now()}`,
        code: rawCode,
        group: group,
        groupName: getGroupName(group),
        name: name,
        description: description,
        zone: zone,
        status: status,
        priority: priority,
        qtyRequired: qtyRequired,
        qtyPresent: qtyPresent,
        location: location,
        notes: notes
      };
      parts.unshift(newPart);
      showToast('Repuesto agregado al checklist', 'success');
    }

    saveData();
    renderGroupSelect();
    renderPlateTabs();
    renderActivePlate();
    render();
    document.getElementById('partModal').style.display = 'none';
  }

  function getGroupName(groupCode) {
    const match = parts.find(p => p.group.toLowerCase() === groupCode.toLowerCase());
    return match ? match.groupName : 'Carrocería & Mecánica';
  }

  // ================= EXPORTACIONES =================
  function setupExportButtons() {
    const btnCsv = document.getElementById('btnExportCsv');
    if (btnCsv) btnCsv.addEventListener('click', exportToCsv);

    const btnWa = document.getElementById('btnWhatsappSummary');
    if (btnWa) btnWa.addEventListener('click', generateWhatsAppSummary);
  }

  function exportToCsv() {
    const missingOnly = parts.filter(p => p.status === 'missing');
    
    const headers = [
      'Código OEM Mercedes-Benz',
      'Grupo de Fábrica',
      'Descripción / Nombre',
      'Detalle Técnico',
      'Zona en Vehículo',
      'Cantidad Faltante',
      'Prioridad',
      'Observaciones de Taller'
    ];

    const rows = missingOnly.map(p => [
      `"${p.code}"`,
      `"${p.group}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${p.zone}"`,
      p.qtyRequired - (p.qtyPresent || 0),
      `"${p.priority.toUpperCase()}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Repuestos_Faltantes_Pagoda_230SL_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo CSV generado y descargado con éxito', 'success');
  }

  function generateOwnerReport() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;

    const missingParts = parts.filter(p => p.status === 'missing');
    const repairParts = parts.filter(p => p.status === 'repair');
    const okParts = parts.filter(p => p.status === 'ok');

    const priorityOrder = { high: 1, medium: 2, low: 3 };
    missingParts.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    const today = new Date().toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    let tableRows = '';
    missingParts.forEach((p, idx) => {
      let prioTag = '<span class="priority-tag" style="background:#fee2e2;color:#991b1b;">ALTA (Urgente)</span>';
      if (p.priority === 'medium') {
        prioTag = '<span class="priority-tag" style="background:#fef3c7;color:#92400e;">MEDIA</span>';
      } else if (p.priority === 'low') {
        prioTag = '<span class="priority-tag" style="background:#f1f5f9;color:#475569;">BAJA</span>';
      }

      tableRows += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td class="td-code">${escapeHtml(p.code)}</td>
          <td><strong>${escapeHtml(p.name)}</strong><br><small style="color:#64748b;">${escapeHtml(p.description || '')}</small></td>
          <td>${p.group}</td>
          <td style="text-align:center;"><strong>${p.qtyRequired - (p.qtyPresent || 0)}</strong></td>
          <td>${prioTag}</td>
          <td><small>${escapeHtml(p.notes || '-')}</small></td>
        </tr>
      `;
    });

    reportContent.innerHTML = `
      <div class="report-header-section">
        <div class="report-header-title">
          <h2>INFORME DE RESTAURACIÓN & REPUESTOS FALTANTES</h2>
          <p style="font-size:0.9rem; color:#475569;"><strong>Vehículo:</strong> Mercedes-Benz 230 SL Pagoda (W113.042) • <strong>Manual de referencia:</strong> Ersatzteilliste 10808</p>
        </div>
        <div class="report-meta-box">
          <div><strong>Fecha:</strong> ${today}</div>
          <div><strong>Chasis / VIN:</strong> ${escapeHtml(vehicleMeta.vin)}</div>
          <div><strong>Propietario:</strong> ${escapeHtml(vehicleMeta.owner)}</div>
        </div>
      </div>

      <div class="report-summary-bar">
        <span><strong>Resumen de auditoría de despiece:</strong></span>
        <span>🔴 <strong>${missingParts.length}</strong> piezas a comprar | 🟡 <strong>${repairParts.length}</strong> a restaurar | 🟢 <strong>${okParts.length}</strong> presentes OK</span>
      </div>

      <h3 style="font-size:1.05rem; margin-bottom:0.6rem; color:#0f172a;">Listado Oficial de Repuestos Requeridos para Compra:</h3>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th style="width: 140px;">Código OEM Mercedes</th>
            <th>Descripción del Repuesto</th>
            <th style="width: 70px;">Grupo</th>
            <th style="width: 50px; text-align:center;">Cant.</th>
            <th style="width: 110px;">Prioridad</th>
            <th>Notas de Taller</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="7" style="text-align:center; padding:1.5rem;">No hay repuestos marcados como faltantes actualmente.</td></tr>'}
        </tbody>
      </table>

      <div class="report-signatures">
        <div class="sig-box">Firma Propietario / Autorización de Compra</div>
        <div class="sig-box">Firma Responsable de Taller de Restauración</div>
      </div>
    `;
  }

  function generateWhatsAppSummary() {
    const missing = parts.filter(p => p.status === 'missing');
    if (missing.length === 0) {
      alert('No hay piezas marcadas como "Falta comprar" en este momento.');
      return;
    }

    const highPrio = missing.filter(p => p.priority === 'high');
    const medPrio = missing.filter(p => p.priority === 'medium');
    const lowPrio = missing.filter(p => p.priority === 'low');

    let text = `📋 *LISTADO DE REPUESTOS FALTANTES - MERCEDES 230 SL PAGODA (W113)*\n`;
    text += `🚗 *Chasis:* ${vehicleMeta.vin} | *Propietario:* ${vehicleMeta.owner}\n`;
    text += `📦 *Total a comprar:* ${missing.length} componentes\n\n`;

    if (highPrio.length > 0) {
      text += `🚨 *PRIORIDAD 1: URGENTES PARA AVANZAR EL ARMADO (${highPrio.length})*\n`;
      highPrio.forEach(p => {
        text += `• *${p.code}* - ${p.name} (Cant: ${p.qtyRequired - (p.qtyPresent || 0)})\n`;
        if (p.notes) text += `   ↳ _Nota: ${p.notes}_\n`;
      });
      text += `\n`;
    }

    if (medPrio.length > 0) {
      text += `⚠️ *PRIORIDAD 2: COMPONENTES SECUNDARIOS (${medPrio.length})*\n`;
      medPrio.forEach(p => {
        text += `• *${p.code}* - ${p.name} (Cant: ${p.qtyRequired - (p.qtyPresent || 0)})\n`;
      });
      text += `\n`;
    }

    if (lowPrio.length > 0) {
      text += `🔹 *PRIORIDAD 3: TERMINACIONES / DETALLES (${lowPrio.length})*\n`;
      lowPrio.forEach(p => {
        text += `• *${p.code}* - ${p.name} (Cant: ${p.qtyRequired - (p.qtyPresent || 0)})\n`;
      });
      text += `\n`;
    }

    text += `_Listado generado con el manual de despiece oficial Mercedes-Benz (Ref. 10808)._`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('¡Texto copiado al portapapeles! Listo para pegar en WhatsApp.', 'success');
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    });
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill';
    toast.innerHTML = `<i class="bi ${icon}"></i> <span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
