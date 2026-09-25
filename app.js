(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const SQRT3 = Math.sqrt(3);
  const SIZE = 70;
  const CENTER = { x: 450, y: 360 };
  const TERRAINS = [
    ...Array(4).fill("forest"), ...Array(4).fill("pasture"), ...Array(4).fill("fields"),
    ...Array(3).fill("hills"), ...Array(3).fill("mountains"), "desert"
  ];
  const TERRAIN_META = {
    forest: { label: "Bosque", color: "#386947" },
    pasture: { label: "Pastos", color: "#91b85b" },
    fields: { label: "Cultivos", color: "#dfbd54" },
    hills: { label: "Colinas", color: "#aa5e3e" },
    mountains: { label: "Montañas", color: "#777d79" },
    desert: { label: "Desierto", color: "#d8bf88" }
  };
  const TERRAIN_ASSETS = Object.fromEntries(
    Object.keys(TERRAIN_META).map(terrain => [terrain, `assets/terrains/${terrain}.png`])
  );
  const PORT_ASSETS = {
    "3:1": "assets/ports/generic.png",
    Madera: "assets/ports/wood.png",
    Lana: "assets/ports/wool.png",
    Trigo: "assets/ports/grain.png",
    Ladrillo: "assets/ports/brick.png",
    Mineral: "assets/ports/ore.png"
  };
  const TOKEN_VALUES = {
    A: 5, B: 2, C: 6, D: 3, E: 8, F: 10, G: 9, H: 12, I: 11,
    J: 4, K: 8, L: 10, M: 9, N: 4, O: 5, P: 6, Q: 3, R: 11
  };
  const LETTERS = Object.keys(TOKEN_VALUES);
  const PIPS = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 };
  const PORTS = ["3:1", "3:1", "3:1", "3:1", "Madera", "Lana", "Trigo", "Ladrillo", "Mineral"];
  const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const coords = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2) coords.push({ q, r });
  coords.sort((a,b) => a.r - b.r || a.q - b.q);
  const coordIndex = new Map(coords.map((c,i) => [`${c.q},${c.r}`, i]));
  const neighbors = coords.map(c => DIRECTIONS.map(([dq,dr]) => coordIndex.get(`${c.q+dq},${c.r+dr}`)).filter(Number.isInteger));

  const el = id => document.getElementById(id);
  const board = el("board");
  let hidden = true;
  let current = null;
  let toastTimer;

  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let a = hashSeed(seed) || 1;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffled(items, rng) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function randomSeed() {
    const left = ["roble","trigo","bruma","isla","puerto","colina","rebaño","cantera"];
    return `${left[Math.floor(Math.random()*left.length)]}-${Math.floor(1000 + Math.random()*9000)}`;
  }
  function point(c) { return { x: CENTER.x + SIZE * SQRT3 * (c.q + c.r/2), y: CENTER.y + SIZE * 1.5 * c.r }; }
  function polygonVertices(cx, cy, size = SIZE) {
    return Array.from({length:6}, (_,i) => { const a = Math.PI/180 * (60*i-30); return {x:cx+size*Math.cos(a),y:cy+size*Math.sin(a)}; });
  }
  function polygonPoints(cx, cy, size = SIZE) {
    return polygonVertices(cx,cy,size).map(p=>`${p.x},${p.y}`).join(" ");
  }
  function boundaryEdges() {
    const edges=new Map();
    coords.forEach(c=>{
      const p=point(c), vertices=polygonVertices(p.x,p.y);
      vertices.forEach((start,i)=>{
        const end=vertices[(i+1)%6];
        const a=`${Math.round(start.x*100)},${Math.round(start.y*100)}`;
        const b=`${Math.round(end.x*100)},${Math.round(end.y*100)}`;
        const key=[a,b].sort().join("|");
        if(edges.has(key)) edges.get(key).shared=true;
        else edges.set(key,{start,end,shared:false});
      });
    });
    return [...edges.values()].filter(edge=>!edge.shared).map(edge=>{
      const midpoint={x:(edge.start.x+edge.end.x)/2,y:(edge.start.y+edge.end.y)/2};
      return {...edge,midpoint,angle:Math.atan2(midpoint.y-CENTER.y,midpoint.x-CENTER.x)};
    }).sort((a,b)=>a.angle-b.angle);
  }
  function connectedClusterTooLarge(terrains) {
    const seen = new Set();
    for (let i=0;i<terrains.length;i++) {
      if (terrains[i] === "desert" || seen.has(i)) continue;
      const stack=[i]; seen.add(i); let count=0;
      while(stack.length){ const n=stack.pop(); count++; for(const m of neighbors[n]) if(!seen.has(m)&&terrains[m]===terrains[i]){seen.add(m);stack.push(m);} }
      if(count>2) return true;
    }
    return false;
  }
  function validTerrain(terrains) { return !connectedClusterTooLarge(terrains); }
  function resourceTotals(terrains, tokens) {
    const totals = { forest:0, pasture:0, fields:0, hills:0, mountains:0 };
    terrains.forEach((terrain,i) => { if(terrain!=="desert") totals[terrain] += PIPS[TOKEN_VALUES[tokens[i]]]; });
    return totals;
  }
  function redCounts(terrains, tokens) {
    const counts = { forest:0, pasture:0, fields:0, hills:0, mountains:0 };
    terrains.forEach((terrain,i) => { if(terrain!=="desert" && [6,8].includes(TOKEN_VALUES[tokens[i]])) counts[terrain]++; });
    return counts;
  }
  function maxVertexPips(terrains, tokens) {
    const vertices = new Map();
    coords.forEach((c,i) => {
      const p=point(c); if(terrains[i]==="desert") return;
      const pip=PIPS[TOKEN_VALUES[tokens[i]]];
      for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-30); const x=Math.round((p.x+SIZE*Math.cos(a))*10)/10; const y=Math.round((p.y+SIZE*Math.sin(a))*10)/10; const key=`${x},${y}`; vertices.set(key,(vertices.get(key)||0)+pip); }
    });
    return Math.max(...vertices.values());
  }
  function validTokens(terrains, tokens) {
    for(let i=0;i<tokens.length;i++){
      if(!tokens[i]) continue;
      const value=TOKEN_VALUES[tokens[i]];
      if([6,8].includes(value) && neighbors[i].some(n => tokens[n] && [6,8].includes(TOKEN_VALUES[tokens[n]]))) return false;
    }
    const totals=resourceTotals(terrains,tokens);
    if(["forest","pasture","fields"].some(k => totals[k]<9 || totals[k]>15)) return false;
    if(["hills","mountains"].some(k => totals[k]<7 || totals[k]>12)) return false;
    if(Object.values(redCounts(terrains,tokens)).some(v => v>2)) return false;
    return maxVertexPips(terrains,tokens) <= 13;
  }
  function generate(seed) {
    const rng=rngFrom(seed);
    let terrains;
    for(let i=0;i<2500;i++){ const t=shuffled(TERRAINS,rng); if(validTerrain(t)){terrains=t;break;} }
    if(!terrains) terrains=shuffled(TERRAINS,rng);
    const landIndices=terrains.map((t,i)=>t!=="desert"?i:-1).filter(i=>i>=0);
    let tokens=Array(19).fill(null), attempts=0;
    for(;attempts<25000;attempts++){
      const candidate=Array(19).fill(null); shuffled(LETTERS,rng).forEach((letter,j)=>candidate[landIndices[j]]=letter);
      if(validTokens(terrains,candidate)){tokens=candidate;break;}
    }
    if(!tokens.some(Boolean)) shuffled(LETTERS,rng).forEach((letter,j)=>tokens[landIndices[j]]=letter);
    const ports=shuffled(PORTS,rng);
    return { seed, terrains, tokens, ports, attempts: attempts+1 };
  }

  function svg(tag, attrs={}, text="") { const node=document.createElementNS(NS,tag); Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v)); if(text) node.textContent=text; return node; }
  function drawPorts(root) {
    if(!el("portsToggle").checked) return;
    const coast=boundaryEdges();
    const selectedEdges=[0,3,7,10,13,17,20,23,27];
    current.ports.forEach((label,i)=>{
      const edge=coast[selectedEdges[i]], dx=edge.midpoint.x-CENTER.x, dy=edge.midpoint.y-CENTER.y;
      const distance=Math.hypot(dx,dy), x=edge.midpoint.x+dx/distance*54, y=edge.midpoint.y+dy/distance*54;
      const g=svg("g",{class:"port","data-edge-index":selectedEdges[i]});
      g.appendChild(svg("line",{x1:edge.start.x,y1:edge.start.y,x2:edge.end.x,y2:edge.end.y,stroke:"#d99f45","stroke-width":7,"stroke-linecap":"round"}));
      [edge.start,edge.end].forEach(vertex=>{
        g.appendChild(svg("line",{x1:vertex.x,y1:vertex.y,x2:x,y2:y,stroke:"#fff8e8","stroke-width":9,"stroke-linecap":"round",opacity:.96}));
        g.appendChild(svg("line",{x1:vertex.x,y1:vertex.y,x2:x,y2:y,stroke:"#315a50","stroke-width":3.2,"stroke-linecap":"round"}));
        g.appendChild(svg("circle",{cx:vertex.x,cy:vertex.y,r:5.5,fill:"#d99f45",stroke:"#fff8e8","stroke-width":2}));
      });
      g.appendChild(svg("circle",{cx:x,cy:y,r:32,fill:"#fff8e8",stroke:"#315a50","stroke-width":3,filter:"url(#shadow)"}));
      g.appendChild(svg("image",{href:PORT_ASSETS[label],x:x-23,y:y-27,width:46,height:46,preserveAspectRatio:"xMidYMid meet"}));
      g.appendChild(svg("rect",{x:x-27,y:y+13,width:54,height:18,rx:9,fill:"#fffaf0",stroke:"#315a50","stroke-width":1.2}));
      g.appendChild(svg("text",{x,y:y+26,"text-anchor":"middle",fill:"#284b43","font-size":label.length>7?7.5:9.5,"font-weight":900},label));
      root.appendChild(g);
    });
  }
  function drawBoard() {
    board.replaceChildren();
    const defs=svg("defs");
    const filter=svg("filter",{id:"shadow",x:"-30%",y:"-30%",width:"160%",height:"160%"});
    filter.appendChild(svg("feDropShadow",{dx:0,dy:5,stdDeviation:5,"flood-opacity":.22})); defs.appendChild(filter); board.appendChild(defs);
    board.appendChild(svg("ellipse",{cx:CENTER.x,cy:CENTER.y+18,rx:343,ry:298,fill:"#77aaa5",opacity:.42}));
    current.terrains.forEach((terrain,i)=>{
      const p=point(coords[i]), meta=TERRAIN_META[terrain], g=svg("g",{class:`hex ${terrain}`});
      const points=polygonPoints(p.x,p.y,SIZE-2), clipId=`hex-clip-${i}`;
      const clip=svg("clipPath",{id:clipId});
      clip.appendChild(svg("polygon",{points}));
      defs.appendChild(clip);
      g.appendChild(svg("polygon",{points,fill:meta.color,filter:"url(#shadow)"}));
      g.appendChild(svg("image",{href:TERRAIN_ASSETS[terrain],x:p.x-SIZE,y:p.y-SIZE,width:SIZE*2,height:SIZE*2,preserveAspectRatio:"xMidYMid slice","clip-path":`url(#${clipId})`}));
      g.appendChild(svg("polygon",{points,fill:"none",stroke:"#f7f0de","stroke-width":7,"stroke-linejoin":"round"}));
      if(terrain!=="desert"){
        const letter=current.tokens[i], number=TOKEN_VALUES[letter], red=[6,8].includes(number);
        g.appendChild(svg("circle",{cx:p.x,cy:p.y,r:30,fill:hidden?"#263c35":"#fff7e6",stroke:hidden?"#e6cf99":(red?"#a62e27":"#493c2c"),"stroke-width":3}));
        g.appendChild(svg("text",{x:p.x,y:p.y+8,"text-anchor":"middle",fill:hidden?"#f4dfaa":(red?"#b62d24":"#251f19"),"font-size":hidden?25:28,"font-weight":900,"font-family":"Georgia"},hidden?letter:number));
        if(!hidden){
          const pip=PIPS[number], start=p.x-(pip-1)*5;
          for(let d=0;d<pip;d++) g.appendChild(svg("circle",{cx:start+d*10,cy:p.y+18,r:2.2,fill:red?"#b62d24":"#3d3328"}));
        }
      } else {
        g.appendChild(svg("rect",{x:p.x-39,y:p.y-13,width:78,height:26,rx:13,fill:"#fff6df",opacity:.9}));
        g.appendChild(svg("text",{x:p.x,y:p.y+5,"text-anchor":"middle",fill:"#6f4e2d","font-size":11,"font-weight":900,"letter-spacing":1.6},"DESIERTO"));
      }
      board.appendChild(g);
    });
    drawPorts(board);
  }
  function setHidden(value) {
    hidden=value; el("hideButton").classList.toggle("active",hidden); el("revealButton").classList.toggle("active",!hidden);
    el("hideButton").setAttribute("aria-pressed",hidden); el("revealButton").setAttribute("aria-pressed",!hidden);
    drawBoard();
  }
  function renderNewMap() {
    const seed=el("seedInput").value.trim()||randomSeed(); el("seedInput").value=seed;
    current=generate(seed); setHidden(true);
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(blob); });
  }
  function loadImage(url) {
    return new Promise((resolve,reject)=>{ const image=new Image(); image.onload=()=>resolve(image); image.onerror=reject; image.src=url; });
  }
  async function downloadMapPng() {
    const button=el("downloadButton"), originalLabel=button.textContent;
    button.disabled=true; button.textContent="Generando…";
    try {
      const clone=board.cloneNode(true), assetCache=new Map();
      clone.setAttribute("xmlns",NS);
      const imageNodes=[...clone.querySelectorAll("image")];
      const assetUrls=[...new Set(imageNodes.map(imageNode=>imageNode.getAttribute("href")).filter(href=>href && !href.startsWith("data:")))];
      await Promise.all(assetUrls.map(async href=>{
          const response=await fetch(new URL(href,location.href));
          if(!response.ok) throw new Error(`No se pudo cargar ${href}`);
          assetCache.set(href,await blobToDataUrl(await response.blob()));
      }));
      imageNodes.forEach(imageNode=>{
        const href=imageNode.getAttribute("href");
        if(assetCache.has(href)) imageNode.setAttribute("href",assetCache.get(href));
      });
      const background=document.createElementNS(NS,"rect");
      Object.entries({x:0,y:0,width:900,height:720,fill:"#c9dfdb"}).forEach(([key,value])=>background.setAttribute(key,value));
      clone.insertBefore(background,clone.firstChild);
      const svgBlob=new Blob([new XMLSerializer().serializeToString(clone)],{type:"image/svg+xml;charset=utf-8"});
      const svgUrl=URL.createObjectURL(svgBlob), image=await loadImage(svgUrl);
      const scale=3, canvas=document.createElement("canvas");
      canvas.width=900*scale; canvas.height=720*scale;
      const context=canvas.getContext("2d");
      context.imageSmoothingEnabled=true; context.imageSmoothingQuality="high";
      context.drawImage(image,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(svgUrl);
      const pngBlob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!pngBlob) throw new Error("No se pudo crear el PNG");
      const pngUrl=URL.createObjectURL(pngBlob), link=document.createElement("a");
      const safeSeed=current.seed.replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"")||"mapa";
      link.href=pngUrl; link.download=`mapa-catan-${safeSeed}.png`; link.click();
      setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);
      toast("PNG descargado");
    } catch(error) {
      console.error(error); toast("No se pudo generar el PNG");
    } finally {
      button.disabled=false; button.textContent=originalLabel;
    }
  }
  function toast(message) { clearTimeout(toastTimer); el("toast").textContent=message; el("toast").classList.add("show"); toastTimer=setTimeout(()=>el("toast").classList.remove("show"),1800); }

  el("generateButton").addEventListener("click",renderNewMap);
  el("randomSeedButton").addEventListener("click",()=>{el("seedInput").value=randomSeed();renderNewMap();});
  el("seedInput").addEventListener("keydown",e=>{if(e.key==="Enter")renderNewMap();});
  el("hideButton").addEventListener("click",()=>setHidden(true));
  el("revealButton").addEventListener("click",()=>setHidden(false));
  el("portsToggle").addEventListener("change",drawBoard);
  el("downloadButton").addEventListener("click",downloadMapPng);
  el("copyButton").addEventListener("click",async()=>{ try{await navigator.clipboard.writeText(el("seedInput").value);toast("Semilla copiada");}catch{toast("No se pudo copiar");} });

  el("seedInput").value=randomSeed();
  renderNewMap();
})();
