import os
import json

HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml_visualizer.html")
TREES_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "trees_data.json")

with open(TREES_JSON_PATH, encoding="utf-8") as f:
    trees_json_str = f.read()

# Full clean JS code
js_block = f"""
    const EMBEDDED_TREES = {trees_json_str};

    function populateTreeSelector() {{
      const selector = document.getElementById('tree-selector');
      if (!selector || typeof EMBEDDED_TREES === 'undefined') return;
      selector.innerHTML = '';
      EMBEDDED_TREES.forEach((item, idx) => {{
        const opt = document.createElement('option');
        opt.value = idx;
        opt.innerText = idx === 0 ? 'Tree #0 (Base Tree - Partisi Utama)' : `Tree #${{idx}} (Koreksi Residual #${{idx}})`;
        selector.appendChild(opt);
      }});
      renderSelectedTree(0);
    }}

    function countLeaves(node) {{
      if (!node) return 0;
      if ('leaf' in node) return 1;
      let count = 0;
      (node.children || []).forEach(child => {{ count += countLeaves(child); }});
      return count;
    }}

    function getMaxDepth(node) {{
      if (!node) return 0;
      if ('leaf' in node) return node.depth || 0;
      let maxD = node.depth || 0;
      (node.children || []).forEach(child => {{
        maxD = Math.max(maxD, getMaxDepth(child));
      }});
      return maxD;
    }}

    function renderNodeHTML(node) {{
      if (!node) return '';
      
      if ('leaf' in node) {{
        const val = node.leaf;
        const isPos = val >= 0;
        return `
          <div style="display: inline-block; margin: 6px; vertical-align: top;">
            <div style="background: ${{isPos ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.15)'}}; border: 1px solid ${{isPos ? 'var(--accent-green)' : 'var(--accent-red)'}}; padding: 8px 14px; border-radius: 8px; font-family: var(--font-mono); font-size: 0.85rem; color: ${{isPos ? 'var(--accent-green)' : 'var(--accent-red)'}}; font-weight: 700;">
              <i class="fa-solid fa-leaf"></i> Residual: ${{val >= 0 ? '+' : ''}}${{val}}
            </div>
          </div>
        `;
      }}

      const leftChild = (node.children || [])[0];
      const rightChild = (node.children || [])[1];

      return `
        <div style="display: inline-block; margin: 10px 8px; vertical-align: top; text-align: center;">
          <div class="tree-node" style="min-width: 190px; cursor: pointer; background: var(--bg-card); border: 1px solid var(--accent-cyan); border-radius: 10px; padding: 10px 14px; display: inline-block;">
            <div style="font-size: 0.75rem; color: var(--accent-cyan); font-family: var(--font-mono); font-weight: 700;">SIMPUL #${{node.nodeid}} (Depth ${{node.depth}})</div>
            <div style="font-weight: 700; margin: 4px 0; color: #FFF; font-size: 0.9rem;">${{node.split_label}}</div>
            <div style="font-size: 0.8rem; color: var(--accent-gold); font-family: var(--font-mono); background: rgba(0,0,0,0.5); padding: 3px 8px; border-radius: 4px;">
              Kondisi: &le; ${{node.split_condition}}
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 20px; margin-top: 8px;">
            ${{leftChild ? `
              <div style="position: relative;">
                <div style="font-size: 0.75rem; color: var(--accent-green); font-weight: 700; margin-bottom: 4px;">
                  <i class="fa-solid fa-arrow-down"></i> YA (&le; ${{node.split_condition}})
                </div>
                ${{renderNodeHTML(leftChild)}}
              </div>
            ` : ''}}

            ${{rightChild ? `
              <div style="position: relative;">
                <div style="font-size: 0.75rem; color: var(--accent-red); font-weight: 700; margin-bottom: 4px;">
                  <i class="fa-solid fa-arrow-down"></i> TIDAK (> ${{node.split_condition}})
                </div>
                ${{renderNodeHTML(rightChild)}}
              </div>
            ` : ''}}
          </div>
        </div>
      `;
    }}

    function renderSelectedTree(treeIdx) {{
      treeIdx = parseInt(treeIdx) || 0;
      if (typeof EMBEDDED_TREES === 'undefined' || !EMBEDDED_TREES[treeIdx]) return;

      const treeData = EMBEDDED_TREES[treeIdx].tree;
      const container = document.getElementById('tree-graph-container');

      const badgeIdx = document.getElementById('tree-badge-idx');
      if (badgeIdx) badgeIdx.innerText = `Tree #${{treeIdx}} ${{treeIdx === 0 ? '(Base Tree)' : '(Boosting Step)'}}`;
      const badgeDepth = document.getElementById('tree-badge-depth');
      if (badgeDepth) badgeDepth.innerText = `Max Depth: ${{getMaxDepth(treeData)}}`;
      const badgeLeaves = document.getElementById('tree-badge-leaves');
      if (badgeLeaves) badgeLeaves.innerText = `Leaves: ${{countLeaves(treeData)}}`;
      const badgeRoot = document.getElementById('tree-badge-root');
      if (badgeRoot) badgeRoot.innerText = `Root Split: ${{treeData.split_label || 'Leaf'}}`;

      if (container) container.innerHTML = renderNodeHTML(treeData);
    }}
"""

with open(HTML_PATH, encoding="utf-8") as f:
    html = f.read()

# Replace script content cleanly
script_start = html.find("<script>")
if script_start != -1:
    before_script = html[:script_start + 8]
    after_script = html[html.rfind("</script>"): ]
    
    # Existing updateSimulation function
    sim_start = html.find("function updateSimulation() {")
    sim_end = html.find("function scrollToSection(id) {")
    sim_code = html[sim_start:sim_end + 120]
    
    new_script_content = f"\n{js_block}\n\n    {sim_code}\n\n    // Initialize\n    updateSimulation();\n    populateTreeSelector();\n  "
    
    final_html = before_script + new_script_content + after_script
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(final_html)
    print("Fixed script tag in ml_visualizer.html!")
else:
    print("Error: <script> tag not found")
