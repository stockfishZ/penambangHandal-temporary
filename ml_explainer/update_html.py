import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_visualizer.html")
TREES_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trees_data.json")

def update_visualizer_html():
    if not os.path.exists(TREES_JSON_PATH):
        print("Error: trees_data.json missing")
        return

    with open(TREES_JSON_PATH, encoding="utf-8") as f:
        trees_data = json.load(f)

    with open(HTML_PATH, encoding="utf-8") as f:
        html = f.read()

    # Create JS variable with embedded JSON data
    embedded_js = f"const EMBEDDED_TREES = {json.dumps(trees_data)};\n"

    # Insert JS variable before updateSimulation()
    if "const EMBEDDED_TREES =" not in html:
        html = html.replace("function updateSimulation() {", embedded_js + "\n    function updateSimulation() {")

    # Replace Section 2 HTML with interactive Tree Explorer UI
    old_section_2 = '<div id="trees" class="card" style="margin-top: 20px;">'
    
    new_section_2_html = """<div id="trees" class="card" style="margin-top: 20px;">
      <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
        <div>
          <div class="card-title"><i class="fa-solid fa-sitemap"></i> Interactive XGBoost Decision Tree Explorer</div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Visualisasi Pohon Keputusan Real dari Model XGBoost NiTERRA</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <label style="font-size: 0.85rem; font-weight: 600; color: var(--accent-cyan);">Pilih Pohon (Tree #):</label>
          <select id="tree-selector" onchange="renderSelectedTree(this.value)" style="width: auto; padding: 6px 12px;">
            <!-- Dynamic options -->
          </select>
        </div>
      </div>

      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
        Model XGBoost NiTERRA terdiri dari <strong>200 Pohon Keputusan</strong>. Pohon #0 melakukan partisi awal, sedangkan Pohon #1–#199 memperbaiki *residual error* secara bertahap. Klik atau jelajahi simpul di bawah ini:
      </p>

      <!-- Tree Metadata Badges -->
      <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div class="metric-badge"><i class="fa-solid fa-tree" style="color: var(--accent-green);"></i> <span id="tree-badge-idx">Tree #0</span></div>
        <div class="metric-badge"><i class="fa-solid fa-layer-group" style="color: var(--accent-cyan);"></i> <span id="tree-badge-depth">Max Depth: 4</span></div>
        <div class="metric-badge"><i class="fa-solid fa-leaf" style="color: var(--accent-gold);"></i> <span id="tree-badge-leaves">Leaves: 16</span></div>
        <div class="metric-badge"><i class="fa-solid fa-filter" style="color: var(--accent-purple);"></i> <span id="tree-badge-root">Root: Litologi Ultramafic</span></div>
      </div>

      <!-- Tree Render Container -->
      <div class="tree-wrapper" style="overflow-x: auto; padding: 24px 12px;">
        <div id="tree-graph-container" style="min-width: 900px; text-align: center;">
          <!-- Dynamic Tree Node Hierarchy -->
        </div>
      </div>
    </div>"""

    # Replace old section 2 card if present
    start_idx = html.find('<div id="trees" class="card"')
    if start_idx != -1:
        end_idx = html.find('<!-- SECTION 3: SPATIAL BLOCK HOLD-OUT -->', start_idx)
        if end_idx != -1:
            html = html[:start_idx] + new_section_2_html + "\n\n    " + html[end_idx:]

    # Add tree rendering functions to JS
    tree_js_code = """
    // --- XGBoost Tree Renderer Functions ---
    function populateTreeSelector() {
      const selector = document.getElementById('tree-selector');
      if (!selector || typeof EMBEDDED_TREES === 'undefined') return;
      selector.innerHTML = '';
      EMBEDDED_TREES.forEach((item, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = idx === 0 ? `Tree #0 (Pohon Utama / Base Tree)` : `Tree #${idx} (Koreksi Residual ${idx})`;
        selector.appendChild(opt);
      });
      renderSelectedTree(0);
    }

    function countLeaves(node) {
      if (!node) return 0;
      if ('leaf' in node) return 1;
      let count = 0;
      (node.children || []).forEach(child => { count += countLeaves(child); });
      return count;
    }

    function getMaxDepth(node) {
      if (!node) return 0;
      if ('leaf' in node) return node.depth || 0;
      let maxD = node.depth || 0;
      (node.children || []).forEach(child => {
        maxD = Math.max(maxD, getMaxDepth(child));
      });
      return maxD;
    }

    function renderNodeHTML(node) {
      if (!node) return '';
      
      if ('leaf' in node) {
        const val = node.leaf;
        const isPos = val >= 0;
        return `
          <div style="display: inline-block; margin: 6px; vertical-align: top;">
            <div style="background: ${isPos ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)'}; border: 1px solid ${isPos ? 'var(--accent-green)' : 'var(--accent-red)'}; padding: 6px 12px; border-radius: 8px; font-family: var(--font-mono); font-size: 0.8rem; color: ${isPos ? 'var(--accent-green)' : 'var(--accent-red)'};">
              <i class="fa-solid fa-leaf"></i> Residual = ${val >= 0 ? '+' : ''}${val}
            </div>
          </div>
        `;
      }

      const leftChild = (node.children || [])[0];
      const rightChild = (node.children || [])[1];

      return `
        <div style="display: inline-block; margin: 10px 8px; vertical-align: top; text-align: center;">
          <!-- Node Box -->
          <div class="tree-node" style="min-width: 180px; cursor: pointer;" title="Node ID: ${node.nodeid}">
            <div style="font-size: 0.75rem; color: var(--accent-cyan); font-family: var(--font-mono);">SIMPUL #${node.nodeid} (Depth ${node.depth})</div>
            <div style="font-weight: 700; margin: 4px 0; color: #FFF;">${node.split_label}</div>
            <div style="font-size: 0.8rem; color: var(--accent-gold); font-family: var(--font-mono); background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px;">
              Kondisi: &le; ${node.split_condition}
            </div>
          </div>

          <!-- Branches (Children) -->
          <div style="display: flex; justify-content: center; gap: 16px; margin-top: 6px; position: relative;">
            ${leftChild ? `
              <div style="position: relative;">
                <div style="font-size: 0.7rem; color: var(--accent-green); font-weight: 700; margin-bottom: 2px;">
                  <i class="fa-solid fa-check"></i> YA (&le; ${node.split_condition})
                </div>
                ${renderNodeHTML(leftChild)}
              </div>
            ` : ''}

            ${rightChild ? `
              <div style="position: relative;">
                <div style="font-size: 0.7rem; color: var(--accent-red); font-weight: 700; margin-bottom: 2px;">
                  <i class="fa-solid fa-xmark"></i> TIDAK (> ${node.split_condition})
                </div>
                ${renderNodeHTML(rightChild)}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    function renderSelectedTree(treeIdx) {
      treeIdx = parseInt(treeIdx) || 0;
      if (typeof EMBEDDED_TREES === 'undefined' || !EMBEDDED_TREES[treeIdx]) return;

      const treeData = EMBEDDED_TREES[treeIdx].tree;
      const container = document.getElementById('tree-graph-container');

      // Update Metadata Badges
      document.getElementById('tree-badge-idx').innerText = `Tree #${treeIdx} ${treeIdx === 0 ? '(Base Tree)' : '(Boosting Step)'}`;
      document.getElementById('tree-badge-depth').innerText = `Max Depth: ${getMaxDepth(treeData)}`;
      document.getElementById('tree-badge-leaves').innerText = `Leaves: ${countLeaves(treeData)}`;
      document.getElementById('tree-badge-root').innerText = `Root Split: ${treeData.split_label || 'Leaf'}`;

      // Render Tree Hierarchy
      container.innerHTML = renderNodeHTML(treeData);
    }

    // Call populateTreeSelector on load
    window.addEventListener('DOMContentLoaded', () => {
      populateTreeSelector();
    });
    """

    if "function populateTreeSelector()" not in html:
        html = html.replace("window.addEventListener('DOMContentLoaded'", tree_js_code + "\n    window.addEventListener('DOMContentLoaded'")
        if "populateTreeSelector();" not in html:
            html = html.replace("updateSimulation();", "updateSimulation();\n    populateTreeSelector();")

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print("Updated ml_visualizer.html with interactive Decision Tree explorer!")

if __name__ == "__main__":
    update_visualizer_html()
