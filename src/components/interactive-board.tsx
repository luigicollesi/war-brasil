"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PLAYER_COLORS, type PlayerColor } from "@/src/lib/lobby";
import type { TerritoryConnection } from "@/src/lib/territory-connections";
import { TERRITORY_METADATA } from "@/src/lib/game-config";
import { JurassicTunnelConnection } from "@/src/components/jurassic-tunnel-connection";
import { RoadNetwork } from "@/src/components/road-network";
import { getTerritoryAnchor, TerritoryArrow, type TerritoryAnchor, type TerritoryArrowKind } from "@/src/components/territory-arrow";

export type BoardTerritory = { territoryId: number; ownerPlayerId: string; ownerName: string; ownerColor: PlayerColor; troops: number };
type TerritoryDetails = { id:number; name:string; region:string; state:string };
type MapArrow = { fromTerritoryId:number; toTerritoryId:number; kind:TerritoryArrowKind } | null;

type InteractiveBoardProps = {
  territories: BoardTerritory[];
  connections?: TerritoryConnection[];
  onSelect?: (territoryId: number) => void;
  selectedTerritoryId?: number | null;
  availableTerritoryIds?: number[];
  targetTerritoryIds?: number[];
  arrow?: MapArrow;
};

const ROAD_VISIBILITY_KEY = "war-brasil:roads-visible";
const regionLabels: Record<string,string> = { norte:"Norte", nordeste:"Nordeste", "centro-oeste":"Centro-Oeste", sudeste:"Sudeste", sul:"Sul" };

const regionBorders: Record<string,{stroke:string;glow:string}> = {
  norte: { stroke:"#55d075", glow:"rgba(85,208,117,.72)" },
  nordeste: { stroke:"#55a8ff", glow:"rgba(85,168,255,.72)" },
  "centro-oeste": { stroke:"#f4c542", glow:"rgba(244,197,66,.72)" },
  sudeste: { stroke:"#ef5555", glow:"rgba(239,85,85,.72)" },
  sul: { stroke:"#f08a35", glow:"rgba(240,138,53,.72)" },
};
const fallbackRegionBorder = {
  stroke:"#ffffff",
  glow:"rgba(255,255,255,.55)",
};
function colorHex(color:PlayerColor) { return PLAYER_COLORS.find(item=>item.value===color)?.hex??"#64756f"; }
function readTerritory(path:SVGPathElement):TerritoryDetails { return { id:Number(path.dataset.id),name:path.dataset.name??"Território",region:path.dataset.region??"",state:path.dataset.uf??"—" }; }

export function InteractiveBoard({ territories, connections=[], onSelect, selectedTerritoryId, availableTerritoryIds=[], targetTerritoryIds=[], arrow=null }:InteractiveBoardProps) {
  const boardRef=useRef<HTMLObjectElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);
  const [mapVersion,setMapVersion]=useState(0);
  const [anchors,setAnchors]=useState<Map<number,TerritoryAnchor>>(new Map());
  const [hovered,setHovered]=useState<{details:TerritoryDetails;x:number;y:number}|null>(null);
  const [roadsVisible,setRoadsVisible]=useState(false);
  const territoryById=useMemo(()=>new Map(territories.map(territory=>[territory.territoryId,territory])),[territories]);

  useEffect(()=>{
    let active=true;
    queueMicrotask(()=>{
      if(!active) return;
      try {
        setRoadsVisible(window.localStorage.getItem(ROAD_VISIBILITY_KEY)==="true");
      } catch {
        setRoadsVisible(false);
      }
    });
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!mapVersion) return;
    const mapDocument=boardRef.current?.contentDocument;
    const paths=Array.from(mapDocument?.querySelectorAll<SVGPathElement>("#territories path.territory")??[]);
    if(!paths.length) return;
    const nextAnchors=new Map<number,TerritoryAnchor>();
    const handlers=new Map<SVGPathElement,{click:()=>void;keyDown:(event:KeyboardEvent)=>void;enter:(event:PointerEvent)=>void;move:(event:PointerEvent)=>void;leave:()=>void}>();
    const moveTooltip=(path:SVGPathElement,event:PointerEvent)=>{
      const rect=containerRef.current?.getBoundingClientRect();
      if(!rect) return;
      setHovered({details:readTerritory(path),x:event.clientX-rect.left+14,y:event.clientY-rect.top+14});
    };
    paths.forEach(path=>{
      nextAnchors.set(Number(path.dataset.id),getTerritoryAnchor(path));
      path.setAttribute("tabindex","0"); path.setAttribute("role","button"); path.setAttribute("aria-label",path.dataset.name??"Território");
      const click=()=>onSelect?.(Number(path.dataset.id));
      const keyDown=(event:KeyboardEvent)=>{ if(event.key==="Enter"||event.key===" "){event.preventDefault();click();} };
      const enter=(event:PointerEvent)=>moveTooltip(path,event);
      const move=(event:PointerEvent)=>moveTooltip(path,event);
      const leave=()=>setHovered(null);
      handlers.set(path,{click,keyDown,enter,move,leave});
      path.addEventListener("click",click); path.addEventListener("keydown",keyDown); path.addEventListener("pointerenter",enter); path.addEventListener("pointermove",move); path.addEventListener("pointerleave",leave);
    });
    setAnchors(nextAnchors);
    return()=>paths.forEach(path=>{const handler=handlers.get(path);if(!handler)return;path.removeEventListener("click",handler.click);path.removeEventListener("keydown",handler.keyDown);path.removeEventListener("pointerenter",handler.enter);path.removeEventListener("pointermove",handler.move);path.removeEventListener("pointerleave",handler.leave);});
  },[mapVersion,onSelect]);

  useEffect(()=>{
    const mapDocument=boardRef.current?.contentDocument; if(!mapDocument) return;
    mapDocument.querySelectorAll<SVGPathElement>("#territories path.territory").forEach(path=>{
      const territory=territoryById.get(Number(path.dataset.id)); if(!territory) return;
      const id=territory.territoryId,available=availableTerritoryIds.includes(id),target=targetTerritoryIds.includes(id),selected=selectedTerritoryId===id;
      const regionStyle=regionBorders[path.dataset.region??""]??fallbackRegionBorder;
      path.style.fill=colorHex(territory.ownerColor);
      path.style.fillOpacity=available||target||selected?"0.86":"0.55";
      path.style.stroke=regionStyle.stroke;
      path.style.strokeWidth=selected?"8":target?"7":available?"5":"4";
      const glowSize=selected||target?"9px":available?"7px":"5px";
      const brightness=target?"1.15":available||selected?"1.08":"1";
      path.style.filter=`brightness(${brightness}) drop-shadow(0 0 ${glowSize} ${regionStyle.glow})`;
      path.classList.toggle("is-selected",selected); path.style.cursor="pointer";
    });
  },[mapVersion,territoryById,selectedTerritoryId,availableTerritoryIds,targetTerritoryIds]);

  const hoveredState=hovered?territoryById.get(hovered.details.id):undefined;
  const relevantConnection=hovered&&selectedTerritoryId&&selectedTerritoryId!==hovered.details.id?connections.find(connection=>(connection.territoryA===selectedTerritoryId&&connection.territoryB===hovered.details.id)||(connection.territoryB===selectedTerritoryId&&connection.territoryA===hovered.details.id)):undefined;
  const from=arrow?anchors.get(arrow.fromTerritoryId):undefined, to=arrow?anchors.get(arrow.toTerritoryId):undefined;
  const jurassicTunnel=connections.find(connection=>connection.barrierName==="Túnel Jurássico");
  const jurassicDestinationId=jurassicTunnel?(jurassicTunnel.territoryA===3?jurassicTunnel.territoryB:jurassicTunnel.territoryA):null;
  const tunnelFrom=jurassicDestinationId?anchors.get(3):undefined;
  const tunnelTo=jurassicDestinationId?anchors.get(jurassicDestinationId):undefined;
  const tunnelTargetName=jurassicDestinationId?TERRITORY_METADATA[jurassicDestinationId]?.name:null;

  function toggleRoads() {
    setRoadsVisible(current=>{
      const next=!current;
      try {
        window.localStorage.setItem(ROAD_VISIBILITY_KEY,String(next));
      } catch {
        // A preferência visual continua funcionando na sessão mesmo sem storage.
      }
      return next;
    });
  }

  return (
    <div className="game-map-canvas" aria-label="Tabuleiro do Brasil">
      <button
        type="button"
        className="game-road-toggle"
        aria-pressed={roadsVisible}
        onClick={toggleRoads}
        title={roadsVisible?"Ocultar estradas":"Mostrar estradas"}
      >
        <span aria-hidden="true">🛣️</span>
        <span>Estradas</span>
        <strong>{roadsVisible?"ON":"OFF"}</strong>
      </button>
      <div ref={containerRef} className="game-map-surface">
        <object
          ref={boardRef}
          data="/war-brasil-42.production.svg"
          type="image/svg+xml"
          title="Mapa interativo do Brasil"
          aria-label="Mapa interativo do Brasil"
          onLoad={()=>setMapVersion(version=>version+1)}
          className="game-map-object"
        >
          <p>Não foi possível carregar o mapa interativo.</p>
        </object>
        <RoadNetwork
          connections={connections}
          anchors={anchors}
          visible={roadsVisible}
          selectedTerritoryId={selectedTerritoryId}
          targetTerritoryIds={targetTerritoryIds}
        />
        {tunnelFrom&&tunnelTo&&tunnelTargetName?<JurassicTunnelConnection from={tunnelFrom} to={tunnelTo} targetName={tunnelTargetName}/>:null}
        {from&&to&&arrow?<TerritoryArrow from={from} to={to} kind={arrow.kind}/>:null}
        {hovered&&hoveredState?<div className="game-territory-tooltip" style={{left:hovered.x,top:hovered.y}}><p className="font-semibold">{hovered.details.name}</p><p className="mt-1 text-[#c8d9d1]">{hoveredState.ownerName} · {regionLabels[hovered.details.region]??hovered.details.region}</p><p className="mt-1 font-semibold text-[#e8c35e]">{hoveredState.troops} tropas</p>{relevantConnection?<p className="mt-2 border-t border-white/15 pt-2 text-[#ffd6a1]">{relevantConnection.barrierName==="Túnel Jurássico"?"🦖 Túnel Jurássico":relevantConnection.passable?"Fronteira militar disponível":relevantConnection.barrierName??"Fronteira bloqueada"}</p>:null}</div>:null}
      </div>
    </div>
  );
}
