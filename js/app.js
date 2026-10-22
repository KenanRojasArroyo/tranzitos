// PENDEJADAS — datos compartidos en tiempo real con Firebase Firestore.
// Estructura en la base de datos:
//   people/{id}  → { name, createdAt }
//   phrases/{id} → { personId, text, createdAt }
// El contador de cada persona = número de frases que tiene (no se guarda aparte).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// ===== Estado =====
let db = null;
let people = [];                 // [{ id, name }]  (más nuevas primero)
let phrasesByPerson = new Map(); // personId → [{ id, text, createdAt }] (más nuevas primero)
let peopleLoaded = false;
let phrasesLoaded = false;
const firstSeen = new Map();     // personId → momento en que apareció (para animar solo tarjetas nuevas)
const POP_WINDOW_MS = 600;       // la animación se mantiene este tiempo aunque lleguen más actualizaciones

// ===== Utilidades =====
// Evita inyección de HTML (XSS)
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTimestamp(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' - ' +
    date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

// ===== Notificaciones (toast) =====
function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const isError = type === 'error';
  const colors = isError
    ? 'bg-slate-900/95 text-rose-300 border-rose-500/40'
    : 'bg-slate-900/95 text-pink-300 border-pink-500/30';
  const icon = isError
    ? 'fa-triangle-exclamation text-rose-400'
    : 'fa-circle-check text-pink-400';

  toast.className = `animate-pop px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-center gap-3 backdrop-blur-md pointer-events-auto transition-all ${colors}`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function setLoadingMessage(text) {
  document.getElementById('loadingText').textContent = text;
}

// ===== Acciones (escriben en Firestore) =====
async function addPerson(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  try {
    await addDoc(collection(db, 'people'), {
      name: trimmedName,
      createdAt: serverTimestamp()
    });
    showToast(`¡${trimmedName} registrado/a!`);
  } catch (err) {
    console.error(err);
    showToast(errorMessage(err), 'error');
  }
}

// Agrega una frase; el contador sube solo porque se cuentan las frases
async function addPhrase(personId, phraseText) {
  const trimmedText = phraseText.trim();
  if (!trimmedText) return;

  const person = people.find(p => p.id === personId);

  try {
    await addDoc(collection(db, 'phrases'), {
      personId,
      text: trimmedText,
      createdAt: serverTimestamp()
    });
    showToast(`+1 pendejada agregada a ${person ? person.name : 'la persona'}`);
  } catch (err) {
    console.error(err);
    showToast(errorMessage(err), 'error');
    // Devolver el texto al campo para no perderlo
    const input = document.querySelector(`#peopleGrid form[data-person-id="${personId}"] .phrase-input`);
    if (input && !input.value) input.value = trimmedText;
  }
}

function errorMessage(err) {
  if (err && err.code === 'permission-denied') {
    return 'Sin permiso: revisa las reglas de Firestore.';
  }
  return 'No se pudo guardar. Revisa tu conexión.';
}

// ===== Render =====
// Conserva lo que la persona está escribiendo y el scroll cuando llegan cambios en vivo
function captureUiState() {
  const state = {};
  document.querySelectorAll('#peopleGrid form[data-person-id]').forEach(form => {
    const input = form.querySelector('.phrase-input');
    const list = form.closest('[data-card]').querySelector('.phrase-list');
    state[form.dataset.personId] = {
      value: input.value,
      focused: document.activeElement === input,
      start: input.selectionStart,
      end: input.selectionEnd,
      scrollTop: list ? list.scrollTop : 0
    };
  });
  return state;
}

function restoreUiState(state) {
  document.querySelectorAll('#peopleGrid form[data-person-id]').forEach(form => {
    const s = state[form.dataset.personId];
    if (!s) return;
    const input = form.querySelector('.phrase-input');
    const list = form.closest('[data-card]').querySelector('.phrase-list');
    input.value = s.value;
    if (list) list.scrollTop = s.scrollTop;
    if (s.focused) {
      input.focus();
      try { input.setSelectionRange(s.start, s.end); } catch (e) { /* ignorar */ }
    }
  });
}

function cardHtml(person) {
  const phrases = phrasesByPerson.get(person.id) || [];
  const seenAt = firstSeen.get(person.id);
  const isNew = seenAt === undefined || Date.now() - seenAt < POP_WINDOW_MS;

  return `
    <div data-card class="${isNew ? 'animate-pop' : ''} bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl hover:border-pink-500/40 transition-all duration-300">

      <div>
        <!-- Encabezado de la tarjeta -->
        <div class="flex items-center gap-3.5 mb-5">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-pink-500/20 shrink-0">
            ${escapeHtml(person.name.charAt(0).toUpperCase())}
          </div>
          <div class="overflow-hidden">
            <h3 class="font-bold text-xl text-slate-100 truncate" title="${escapeHtml(person.name)}">
              ${escapeHtml(person.name)}
            </h3>
            <span class="text-xs text-slate-500">Registrado/a</span>
          </div>
        </div>

        <!-- Contador (sin botones de modificación manual) -->
        <div class="bg-slate-950/90 rounded-2xl p-4 mb-5 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Contador de Pendejadas</span>
            <div class="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-300 to-purple-400 mt-0.5">
              ${phrases.length}
            </div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 text-lg">
            <i class="fa-solid fa-fire"></i>
          </div>
        </div>

        <!-- Formulario para agregar frase -->
        <form data-person-id="${escapeHtml(person.id)}" class="mb-5">
          <label class="block text-xs font-semibold text-slate-400 mb-1.5">Agregar nueva frase:</label>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Escribe la pendejada..."
              required
              maxlength="300"
              autocomplete="off"
              class="phrase-input w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:border-pink-500 text-sm text-slate-200 placeholder-slate-600 transition-all"
            >
            <button
              type="submit"
              title="Agregar Frase (+1 al contador)"
              class="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-semibold rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <i class="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </form>
      </div>

      <!-- Historial de frases -->
      <div class="mt-1 border-t border-slate-800/60 pt-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Frases Registradas</span>
          <span class="text-[10px] bg-slate-800 text-pink-400 px-2.5 py-0.5 rounded-full font-bold border border-slate-700">${phrases.length}</span>
        </div>

        <div class="phrase-list max-h-48 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
          ${phrases.length === 0
            ? '<p class="text-xs text-slate-600 italic py-4 text-center">Aún no hay frases registradas.</p>'
            : phrases.map(p => `
              <div class="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl text-xs text-slate-300 transition-all">
                <p class="text-slate-200 font-medium leading-relaxed">"${escapeHtml(p.text)}"</p>
                <span class="text-[9px] text-slate-500 mt-1.5 block font-mono">${escapeHtml(formatTimestamp(p.createdAt))}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

    </div>
  `;
}

function render() {
  const grid = document.getElementById('peopleGrid');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const totalPersonsEl = document.getElementById('totalPersons');
  const totalCountEl = document.getElementById('totalCount');

  // Hasta recibir los primeros datos mostramos "cargando"
  if (!peopleLoaded || !phrasesLoaded) {
    loadingState.classList.remove('hidden');
    loadingState.classList.add('flex');
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
    return;
  }
  loadingState.classList.add('hidden');
  loadingState.classList.remove('flex');

  // Totales globales
  totalPersonsEl.textContent = people.length;
  totalCountEl.textContent = people.reduce((acc, p) => acc + (phrasesByPerson.get(p.id) || []).length, 0);

  if (people.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }

  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  const uiState = captureUiState();
  grid.innerHTML = people.map(cardHtml).join('');
  restoreUiState(uiState);
  people.forEach(p => {
    if (!firstSeen.has(p.id)) firstSeen.set(p.id, Date.now());
  });
}

// ===== Sincronización en vivo =====
function onSyncError(err) {
  console.error(err);
  const msg = err && err.code === 'permission-denied'
    ? 'Sin permiso para leer: revisa las reglas de Firestore.'
    : 'No se pudo conectar con la base de datos.';
  setLoadingMessage(msg);
  showToast(msg, 'error');
}

function startListening() {
  onSnapshot(
    query(collection(db, 'people'), orderBy('createdAt', 'desc')),
    (snap) => {
      people = snap.docs.map(d => ({ id: d.id, name: d.data({ serverTimestamps: 'estimate' }).name }));
      peopleLoaded = true;
      render();
    },
    onSyncError
  );

  onSnapshot(
    query(collection(db, 'phrases'), orderBy('createdAt', 'desc')),
    (snap) => {
      const map = new Map();
      snap.docs.forEach(d => {
        const data = d.data({ serverTimestamps: 'estimate' });
        const list = map.get(data.personId) || [];
        list.push({
          id: d.id,
          text: data.text,
          createdAt: data.createdAt ? data.createdAt.toDate() : null
        });
        map.set(data.personId, list);
      });
      phrasesByPerson = map;
      phrasesLoaded = true;
      render();
    },
    onSyncError
  );
}

// ===== Eventos =====
document.getElementById('addPersonForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('personNameInput');
  const name = input.value;
  input.value = '';
  addPerson(name);
});

// Un solo listener para todos los formularios de frases (se regeneran en cada render)
document.getElementById('peopleGrid').addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-person-id]');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('.phrase-input');
  const text = input.value;
  if (!text.trim()) return;
  input.value = '';
  addPhrase(form.dataset.personId, text);
});

// ===== Inicio =====
function init() {
  const configMissing = [firebaseConfig.apiKey, firebaseConfig.projectId]
    .some(v => typeof v !== 'string' || v.startsWith('PEGA_AQUI'));

  if (configMissing) {
    setLoadingMessage('Falta configurar Firebase: pega tus datos en js/firebase-config.js');
    document.getElementById('loadingSpinner').classList.add('hidden');
    return;
  }

  db = getFirestore(initializeApp(firebaseConfig));
  startListening();
}

init();
