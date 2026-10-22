// ===== Estado de la aplicación =====
const STORAGE_KEY = 'pendejadas_tracker_clean_data';
let people = [];

// ===== Persistencia (localStorage) =====
function loadState() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData) {
    try {
      people = JSON.parse(savedData);
    } catch (e) {
      console.error('Error al cargar datos guardados:', e);
      people = [];
    }
  } else {
    people = []; // Completamente vacío
  }
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

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

// ===== Notificaciones (toast) =====
function showToast(message) {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'animate-pop px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium flex items-center gap-3 backdrop-blur-md pointer-events-auto transition-all bg-slate-900/95 text-pink-300 border-pink-500/30';

  toast.innerHTML = `<i class="fa-solid fa-circle-check text-pink-400"></i> <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Acciones =====
function addPerson(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const newPerson = {
    id: Date.now().toString(),
    name: trimmedName,
    count: 0,
    phrases: []
  };

  people.unshift(newPerson);
  saveState();
  render();
  showToast(`¡${newPerson.name} registrado/a!`);
}

// Agrega una frase y suma +1 al contador automáticamente
function addPhrase(personId, phraseText) {
  const trimmedText = phraseText.trim();
  if (!trimmedText) return;

  const person = people.find(p => p.id === personId);
  if (!person) return;

  const now = new Date();
  const timeFormatted =
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' - ' +
    now.toLocaleDateString([], { day: '2-digit', month: 'short' });

  const newPhrase = {
    id: Date.now().toString(),
    text: trimmedText,
    timestamp: timeFormatted
  };

  person.phrases.unshift(newPhrase);
  person.count += 1; // Incremento automático solo al agregar frase

  saveState();
  render();
  showToast(`+1 pendejada agregada a ${person.name}`);
}

// ===== Render =====
function render() {
  const grid = document.getElementById('peopleGrid');
  const emptyState = document.getElementById('emptyState');
  const totalPersonsEl = document.getElementById('totalPersons');
  const totalCountEl = document.getElementById('totalCount');

  // Totales globales
  totalPersonsEl.textContent = people.length;
  totalCountEl.textContent = people.reduce((acc, p) => acc + p.count, 0);

  if (people.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
    return;
  }

  emptyState.classList.add('hidden');
  emptyState.classList.remove('flex');

  grid.innerHTML = people.map(person => `
    <div class="animate-pop bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl hover:border-pink-500/40 transition-all duration-300">

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
              ${person.count}
            </div>
          </div>
          <div class="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 text-lg">
            <i class="fa-solid fa-fire"></i>
          </div>
        </div>

        <!-- Formulario para agregar frase -->
        <form onsubmit="handlePhraseSubmit(event, '${escapeHtml(person.id)}')" class="mb-5">
          <label class="block text-xs font-semibold text-slate-400 mb-1.5">Agregar nueva frase:</label>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Escribe la pendejada..."
              required
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
          <span class="text-[10px] bg-slate-800 text-pink-400 px-2.5 py-0.5 rounded-full font-bold border border-slate-700">${person.phrases.length}</span>
        </div>

        <div class="max-h-48 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
          ${person.phrases.length === 0
            ? '<p class="text-xs text-slate-600 italic py-4 text-center">Aún no hay frases registradas.</p>'
            : person.phrases.map(p => `
              <div class="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl text-xs text-slate-300 transition-all">
                <p class="text-slate-200 font-medium leading-relaxed">"${escapeHtml(p.text)}"</p>
                <span class="text-[9px] text-slate-500 mt-1.5 block font-mono">${escapeHtml(p.timestamp)}</span>
              </div>
            `).join('')
          }
        </div>
      </div>

    </div>
  `).join('');
}

// ===== Manejadores de eventos =====
// Debe ser global porque se llama desde el onsubmit generado en render()
function handlePhraseSubmit(event, personId) {
  event.preventDefault();
  const input = event.target.querySelector('.phrase-input');
  if (input && input.value) {
    addPhrase(personId, input.value);
    input.value = '';
  }
}

document.getElementById('addPersonForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('personNameInput');
  addPerson(input.value);
  input.value = '';
});

// ===== Inicio =====
window.addEventListener('load', loadState);
