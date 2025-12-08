// Worldr Client App

// State
let documents = [];
let currentDoc = null;
let entities = [];
let navigationHistory = [];  // Stack of {type, id} for back navigation

// DOM elements
const indexContent = document.getElementById('index-content');
const contentPanel = document.getElementById('content-panel');
const docSelect = document.getElementById('doc-select');
const searchInput = document.getElementById('search-input');
const toggleBtn = document.getElementById('toggle-btn');
const indexPanel = document.getElementById('index-panel');
const backBtn = document.getElementById('back-btn');

// Toggle index panel
toggleBtn.addEventListener('click', () => {
  indexPanel.classList.toggle('collapsed');
});

// Update back button state
function updateBackButton() {
  backBtn.disabled = navigationHistory.length === 0;
}

// Back button click
backBtn.addEventListener('click', () => {
  if (navigationHistory.length === 0) return;
  
  const prev = navigationHistory.pop();
  updateBackButton();
  
  if (prev.type === 'document') {
    loadDocument(prev.id, false);  // false = don't push to history
  } else if (prev.type === 'entity') {
    loadEntity(prev.id, false);    // false = don't push to history
  }
});

// Load document list
async function loadDocuments() {
  try {
    const res = await fetch('/api/documents');
    documents = await res.json();
    
    // Populate dropdown
    docSelect.innerHTML = '<option value="">Select a document...</option>';
    for (const doc of documents) {
      const option = document.createElement('option');
      option.value = doc;
      option.textContent = doc.replace('.md', '');
      docSelect.appendChild(option);
    }
  } catch (err) {
    console.error('Failed to load documents:', err);
  }
}

// Load entities for the index
async function loadEntities() {
  try {
    const res = await fetch('/api/entities');
    entities = await res.json();
    renderIndex();
  } catch (err) {
    console.error('Failed to load entities:', err);
  }
}

// Render the index panel
function renderIndex() {
  if (entities.length === 0) {
    indexContent.innerHTML = '<div class="index-item">No entities found</div>';
    return;
  }
  
  indexContent.innerHTML = '';
  for (const entity of entities) {
    const item = document.createElement('a');
    item.className = 'index-item level-1';
    item.textContent = entity.entityId;
    item.href = '#';
    item.addEventListener('click', (e) => {
      e.preventDefault();
      loadEntity(entity.entityId);
    });
    indexContent.appendChild(item);
  }
}

// Load and render a document
async function loadDocument(docId, addToHistory = true) {
  if (!docId) return;
  
  // Push current view to history before navigating
  if (addToHistory && currentDoc) {
    navigationHistory.push({ type: 'document', id: currentDoc });
    updateBackButton();
  }
  
  contentPanel.innerHTML = '<p class="loading">Loading...</p>';
  
  try {
    const res = await fetch(`/api/render/${encodeURIComponent(docId)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    contentPanel.innerHTML = data.html;
    currentDoc = docId;
    attachEntityLinkHandlers();
  } catch (err) {
    contentPanel.innerHTML = `<p>Error loading document: ${err.message}</p>`;
  }
}

// Track current entity for history
let currentEntityId = null;

// Load and render an entity
async function loadEntity(entityId, addToHistory = true) {
  // Push current view to history before navigating
  if (addToHistory) {
    if (currentEntityId) {
      navigationHistory.push({ type: 'entity', id: currentEntityId });
    } else if (currentDoc) {
      navigationHistory.push({ type: 'document', id: currentDoc });
    }
    updateBackButton();
  }
  
  contentPanel.innerHTML = '<p class="loading">Loading...</p>';
  
  try {
    const res = await fetch(`/api/render-entity/${encodeURIComponent(entityId)}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    contentPanel.innerHTML = data.html;
    currentEntityId = entityId;
    currentDoc = null;  // Clear doc since we're viewing an entity
    
    // Update active state in index
    document.querySelectorAll('.index-item').forEach(item => {
      item.classList.toggle('active', item.textContent === entityId);
    });
    
    attachEntityLinkHandlers();
  } catch (err) {
    contentPanel.innerHTML = `<p>Error loading entity: ${err.message}</p>`;
  }
}

// Attach click handlers to entity cross-links
function attachEntityLinkHandlers() {
  contentPanel.querySelectorAll('.entity-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const entityId = link.dataset.entityId;
      if (entityId) {
        loadEntity(entityId);
      }
    });
  });
}

// Handle document selection
docSelect.addEventListener('change', (e) => {
  loadDocument(e.target.value);
});

// Handle search
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (!query) {
    renderIndex();
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await res.json();
      
      indexContent.innerHTML = '';
      
      if (results.length === 0) {
        indexContent.innerHTML = '<div class="index-item">No results found</div>';
        return;
      }
      
      for (const result of results) {
        const item = document.createElement('a');
        item.className = 'index-item level-1';
        item.innerHTML = `<strong>${result.entityId}</strong><br><small>${result.snippet.slice(0, 60)}...</small>`;
        item.href = '#';
        item.addEventListener('click', (e) => {
          e.preventDefault();
          loadEntity(result.entityId);
        });
        indexContent.appendChild(item);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, 300);
});

// Initialize
loadDocuments();
loadEntities();
