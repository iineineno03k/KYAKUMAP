"use client";

import {
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  Info,
  LocateFixed,
  LockKeyhole,
  Minus,
  Network,
  Plus,
  Route,
  Sparkles,
  SquareArrowOutUpRight,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const icons = { user: UserRound, spark: Sparkles, people: UsersRound, route: Route, heart: Heart };
type Panel = {
  id: string;
  title: string;
  icon: string;
  status: string;
  summary: string | null;
  unlockHint: string | null;
  items: Array<{
    id: string;
    label: string;
    status: string;
    valueText: string | null;
    unlockHint: string | null;
    weight: number;
  }>;
};
type Evidence = {
  id: string;
  panelId: string;
  fact: string;
  sourceLabel: string;
  authorName: string;
  sourceUrl: string | null;
};
type GraphNode = {
  id: string;
  name: string;
  description: string;
  type: string;
  imageUrl: string | null;
  depth: number;
  href: string | null;
};
type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  confidence: number;
  status: string;
  sourceLabel: string;
};
type Point = { x: number; y: number };
type MotionPoint = Point & { vx: number; vy: number };

function graphPositions(nodes: GraphNode[]) {
  const positions = new Map<string, Point>();
  const root = nodes.find((node) => node.depth === 0);
  if (root) positions.set(root.id, { x: 50, y: 48 });
  for (const depth of [1, 2]) {
    const ring = nodes.filter((node) => node.depth === depth);
    const radiusX = depth === 1 ? 27 : 43;
    const radiusY = depth === 1 ? 28 : 38;
    ring.forEach((node, index) => {
      const startAngle = depth === 1 ? -Math.PI / 2 : 0;
      const angle = startAngle + (Math.PI * 2 * index) / Math.max(ring.length, 1);
      positions.set(node.id, {
        x: 50 + Math.cos(angle) * radiusX,
        y: 48 + Math.sin(angle) * radiusY,
      });
    });
  }
  return positions;
}

function RelationshipGraph({
  nodes,
  edges,
  sectionId,
  focusNodeId,
  onCreateQuestion,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  sectionId: string;
  focusNodeId: string | null;
  onCreateQuestion: (question: string) => void;
}) {
  const titleId = useId();
  const canvasRef = useRef<HTMLDivElement>(null);
  const positionsRef = useRef(graphPositions(nodes));
  const draggedNodeRef = useRef<string | null>(null);
  const draggedNodeMovedRef = useRef(false);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [positions, setPositions] = useState(() => new Map(positionsRef.current));
  const [selectedId, setSelectedId] = useState(nodes.find((node) => node.depth === 0)?.id ?? "");
  const [simulationVersion, setSimulationVersion] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedEdges = edges.filter((edge) => edge.from === selectedId || edge.to === selectedId);

  useEffect(() => {
    if (!focusNodeId) return;
    setSelectedId(focusNodeId);
    setView({ x: 0, y: 0, zoom: 1 });
  }, [focusNodeId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ドラッグ終了時に力学計算を再始動するためのトリガー
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let animationFrame = 0;
    let tick = 0;
    const step = () => {
      const next = new Map<string, MotionPoint>(
        [...positionsRef.current].map(([id, point]): [string, MotionPoint] => {
          const motionPoint = point as Point & Partial<MotionPoint>;
          return [
            id,
            {
              x: point.x,
              y: point.y,
              vx: motionPoint.vx ?? 0,
              vy: motionPoint.vy ?? 0,
            },
          ];
        }),
      );
      const entries = [...next.entries()];
      for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
          const [, first] = entries[firstIndex];
          const [, second] = entries[secondIndex];
          const dx = second.x - first.x;
          const dy = second.y - first.y;
          const distanceSquared = Math.max(dx * dx + dy * dy, 20);
          const distance = Math.sqrt(distanceSquared);
          const force = 5.5 / distanceSquared;
          const forceX = (dx / distance) * force;
          const forceY = (dy / distance) * force;
          first.vx -= forceX;
          first.vy -= forceY;
          second.vx += forceX;
          second.vy += forceY;
        }
      }
      for (const edge of edges) {
        const from = next.get(edge.from);
        const to = next.get(edge.to);
        if (!from || !to) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.1);
        const spring = (distance - 28) * 0.0045;
        const springX = (dx / distance) * spring;
        const springY = (dy / distance) * spring;
        from.vx += springX;
        from.vy += springY;
        to.vx -= springX;
        to.vy -= springY;
      }
      let energy = 0;
      const centerId = nodes.find((node) => node.depth === 0)?.id;
      for (const [id, point] of next) {
        if (id === draggedNodeRef.current) continue;
        const gravity = id === centerId ? 0.008 : 0.0015;
        point.vx += (50 - point.x) * gravity;
        point.vy += (48 - point.y) * gravity;
        point.vx *= 0.84;
        point.vy *= 0.84;
        point.x = Math.min(92, Math.max(8, point.x + point.vx));
        point.y = Math.min(88, Math.max(10, point.y + point.vy));
        energy += Math.abs(point.vx) + Math.abs(point.vy);
      }
      positionsRef.current = next;
      setPositions(new Map(next));
      tick += 1;
      if (tick < 180 && energy > 0.012) animationFrame = requestAnimationFrame(step);
    };
    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [edges, nodes, simulationVersion]);

  const setZoom = (nextZoom: number) => {
    setView((current) => ({ ...current, zoom: Math.min(2, Math.max(0.65, nextZoom)) }));
  };
  const resetGraph = () => {
    const resetPositions = graphPositions(nodes);
    positionsRef.current = resetPositions;
    setPositions(new Map(resetPositions));
    setView({ x: 0, y: 0, zoom: 1 });
    setSimulationVersion((version) => version + 1);
  };
  const moveDraggedNode = (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => {
    if (draggedNodeRef.current !== nodeId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x =
      50 + ((event.clientX - rect.left - rect.width / 2 - view.x) / view.zoom / rect.width) * 100;
    const y =
      50 + ((event.clientY - rect.top - rect.height / 2 - view.y) / view.zoom / rect.height) * 100;
    const next = new Map(positionsRef.current);
    next.set(nodeId, { x: Math.min(94, Math.max(6, x)), y: Math.min(92, Math.max(8, y)) });
    positionsRef.current = next;
    setPositions(next);
    draggedNodeMovedRef.current = true;
  };

  return (
    <section id={sectionId} className="relationship-graph" aria-labelledby={titleId}>
      <div className="relationship-graph-heading">
        <div>
          <h2 id={titleId} className="text-xl font-black text-indigo-950">
            人物・関係マップ
          </h2>
          <p className="mt-1 text-xs font-bold text-indigo-950/50">
            社内記録から対応づいた人物と接点です。選ぶと根拠を確認できます。
          </p>
        </div>
        <Network className="size-6 text-indigo-950/45" aria-hidden="true" />
      </div>

      <div
        ref={canvasRef}
        className={isPanning ? "relationship-canvas is-panning" : "relationship-canvas"}
        onPointerDown={(event) => {
          if (event.button !== 0 || event.pointerType === "touch") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsPanning(true);
          panRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: view.x,
            originY: view.y,
          };
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (!pan || pan.pointerId !== event.pointerId) return;
          setView((current) => ({
            ...current,
            x: pan.originX + event.clientX - pan.startX,
            y: pan.originY + event.clientY - pan.startY,
          }));
        }}
        onPointerUp={(event) => {
          if (panRef.current?.pointerId === event.pointerId) {
            panRef.current = null;
            setIsPanning(false);
          }
        }}
        onPointerCancel={() => {
          panRef.current = null;
          setIsPanning(false);
        }}
      >
        <fieldset className="relationship-graph-controls">
          <legend className="sr-only">グラフ表示操作</legend>
          <button
            type="button"
            aria-label="拡大"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom(view.zoom + 0.15)}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="縮小"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom(view.zoom - 0.15)}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="表示をリセット"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={resetGraph}
          >
            <LocateFixed aria-hidden="true" />
          </button>
        </fieldset>
        <div
          className="relationship-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          <svg
            className="relationship-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {edges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={edge.status === "supported" ? "is-supported" : "is-candidate"}
                />
              );
            })}
          </svg>
          <fieldset className="relationship-nodes">
            <legend className="sr-only">関係者</legend>
            {nodes.map((node) => {
              const point = positions.get(node.id);
              if (!point) return null;
              const nodeClass = [
                "relationship-node",
                node.depth === 0 ? "is-center" : node.depth === 2 ? "is-distant" : "",
                node.type === "internal_member" ? "is-internal" : "",
                node.id === selectedId ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={node.id}
                  type="button"
                  className={nodeClass}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onPointerDown={(event) => {
                    if (event.pointerType === "touch") return;
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    draggedNodeRef.current = node.id;
                    draggedNodeMovedRef.current = false;
                  }}
                  onPointerMove={(event) => moveDraggedNode(event, node.id)}
                  onPointerUp={() => {
                    if (draggedNodeRef.current !== node.id) return;
                    draggedNodeRef.current = null;
                    setSimulationVersion((version) => version + 1);
                  }}
                  onPointerCancel={() => {
                    if (draggedNodeRef.current !== node.id) return;
                    draggedNodeRef.current = null;
                  }}
                  onClick={() => {
                    if (draggedNodeMovedRef.current) {
                      draggedNodeMovedRef.current = false;
                      return;
                    }
                    setSelectedId(node.id);
                  }}
                  aria-pressed={node.id === selectedId}
                >
                  <span
                    className={
                      node.imageUrl ? "relationship-node-dot has-photo" : "relationship-node-dot"
                    }
                  >
                    {node.imageUrl ? (
                      <Image
                        src={node.imageUrl}
                        alt=""
                        fill
                        className="relationship-node-photo"
                        sizes={node.depth === 0 ? "64px" : "42px"}
                      />
                    ) : (
                      node.name.slice(0, 1)
                    )}
                  </span>
                  <span className="relationship-node-label">{node.name}</span>
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>

      {selected ? (
        <div className="relationship-detail" aria-live="polite">
          <div className="min-w-0">
            <p className="font-black text-indigo-950">
              {selected.name}
              {selected.type === "internal_member" ? (
                <span className="ml-2 rounded-full bg-mint px-2 py-0.5 text-[10px]">社内</span>
              ) : null}
            </p>
            <p className="text-xs font-bold text-indigo-950/50">{selected.description}</p>
            {selectedEdges.slice(0, 2).map((edge) => (
              <p key={edge.id} className="mt-1 text-[11px] font-bold text-indigo-950/65">
                {edge.label} <span className="text-indigo-950/35">・{edge.sourceLabel}</span>
              </p>
            ))}
          </div>
          {selected.href && selected.depth !== 0 ? (
            <Link href={selected.href} className="relationship-detail-link">
              詳細 <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
          {selected.depth !== 0 ? (
            <button
              type="button"
              className="relationship-detail-link"
              onClick={() =>
                onCreateQuestion(`${selected.name}さんとは、どのようなつながりがありますか？`)
              }
            >
              確認事項を作る <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-bold text-indigo-950/45">
        <span>
          <i className="graph-legend is-customer" />
          顧客・外部
        </span>
        <span>
          <i className="graph-legend is-internal" />
          社内の接点
        </span>
        <span>
          <i className="graph-legend is-distant" />
          2段先
        </span>
      </div>
    </section>
  );
}

export function StrategyBoard({
  customerId,
  salesProfile,
  panels,
  evidence,
  graph,
  nextQuestion,
  children,
}: {
  customerId: string;
  salesProfile: Record<string, string>;
  panels: Panel[];
  evidence: Evidence[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  nextQuestion: string | null;
  children: React.ReactNode;
}) {
  const progressTitleId = useId();
  const graphSectionId = useId();
  const modalTitleId = useId();
  const unlockTitleId = useId();
  const readyPanel = panels.find((panel) => panel.status === "ready");
  const [revealed, setRevealed] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [showUnlock, setShowUnlock] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const selectedPanel = panels.find((panel) => panel.id === selectedPanelId) ?? null;
  const allItems = panels.flatMap((panel) => panel.items);
  const isKnown = (item: Panel["items"][number]) =>
    item.status === "known" || (item.status === "ready" && revealed);
  const completedItems = allItems.filter(isKnown);
  const totalWeight = allItems.reduce((sum, item) => sum + item.weight, 0);
  const completedWeight = completedItems.reduce((sum, item) => sum + item.weight, 0);
  const progress = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const clueStorageKey = readyPanel ? `customer-clue:${customerId}:${readyPanel.id}` : null;
  const discoveredNode = readyPanel
    ? graph.nodes.find(
        (node) =>
          node.depth > 0 &&
          readyPanel.summary?.includes(node.name.trim().split(/[\s　]+/)[0] ?? node.name),
      )
    : null;

  const openDialog = (panelId: string) => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedPanelId(panelId);
  };
  const closeDialog = () => {
    setSelectedPanelId(null);
    setShowUnlock(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  };
  const draftCustomerAiQuestion = (question: string) => {
    window.dispatchEvent(new CustomEvent("customer-ai-suggest-question", { detail: question }));
  };
  const handleReveal = () => {
    setRevealed(true);
    if (clueStorageKey) window.localStorage.setItem(clueStorageKey, "revealed");
    if (discoveredNode) {
      setFocusedNodeId(discoveredNode.id);
      requestAnimationFrame(() => {
        document
          .getElementById(graphSectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setShowUnlock(true);
  };
  const moveToCustomerAi = () => {
    const unknownLabels = selectedPanel?.items
      .filter((item) => !isKnown(item))
      .map((item) => item.label);
    const topic = unknownLabels?.slice(0, 2).join("と") || selectedPanel?.title;
    closeDialog();
    draftCustomerAiQuestion(`${topic}について、教えてもらえますか？`);
  };
  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (selectedPanel || showUnlock) dialogRef.current?.focus();
  }, [selectedPanel, showUnlock]);

  useEffect(() => {
    if (clueStorageKey && window.localStorage.getItem(clueStorageKey) === "revealed") {
      setRevealed(true);
    }
  }, [clueStorageKey]);

  return (
    <>
      <details className="sales-memo">
        <summary>
          <span>
            <strong className="sales-memo-title">営業前メモ</strong>
            <small>{salesProfile.summary ?? "人物像を整理中"}</small>
          </span>
          <span className="sales-memo-action">開く</span>
        </summary>
        <div className="sales-memo-content">
          <div>
            <p>今の関心</p>
            <strong className="sales-memo-value">
              {salesProfile.currentFocus ?? "情報を確認中"}
            </strong>
          </div>
          <div>
            <p>判断で重視すること</p>
            <strong className="sales-memo-value">{salesProfile.winningAngle ?? "確認中"}</strong>
          </div>
          <div>
            <p>話すときの注意</p>
            <strong className="sales-memo-value">{salesProfile.avoid ?? "確認中"}</strong>
          </div>
        </div>
      </details>

      {readyPanel && !revealed ? (
        <section className="discovery-banner" aria-label="新しい手がかり">
          <div className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-indigo-950 bg-yellow-300 shadow-[3px_3px_0_#1e1b4b]">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-indigo-950/50">新しい手がかり</p>
            <h2 className="mt-1 text-lg font-black text-indigo-950">{readyPanel.summary}</h2>
          </div>
          <button type="button" onClick={handleReveal} className="game-button">
            マップで見る <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </section>
      ) : null}

      <div className="knowledge-workspace">
        <RelationshipGraph
          nodes={graph.nodes}
          edges={graph.edges}
          sectionId={graphSectionId}
          focusNodeId={focusedNodeId}
          onCreateQuestion={draftCustomerAiQuestion}
        />

        <section className="knowledge-progress" aria-labelledby={progressTitleId}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={progressTitleId} className="text-xl font-black text-indigo-950">
                情報充足度
              </h2>
              <p className="mt-1 text-xs font-bold text-indigo-950/50">
                記録から確認できている範囲
              </p>
            </div>
            <div className="knowledge-score">
              <strong>{progress}%</strong>
              <span>情報確認済み</span>
            </div>
          </div>
          <div className="mt-4">
            <div
              className="knowledge-progress-track"
              role="progressbar"
              aria-label="顧客情報の充足度"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-right font-mono text-[10px] font-bold tracking-wider text-indigo-950/45">
              {completedItems.length} / {allItems.length} 確認済み
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 font-bold text-indigo-950/55">
            各領域を選ぶと、根拠がある情報と次に確認したい情報を見られます。
          </p>
          {nextQuestion ? (
            <div className="next-confirmation">
              <div>
                <p>次に確認したいこと</p>
                <strong>{nextQuestion}</strong>
              </div>
              <button type="button" onClick={() => draftCustomerAiQuestion(nextQuestion)}>
                この質問を聞く <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="mt-3 grid gap-2">
            {panels.map((panel) => {
              const Icon = icons[panel.icon as keyof typeof icons] ?? Sparkles;
              const knownItems = panel.items.filter(isKnown);
              const panelWeight = panel.items.reduce((sum, item) => sum + item.weight, 0);
              const knownWeight = knownItems.reduce((sum, item) => sum + item.weight, 0);
              const panelProgress = panelWeight ? Math.round((knownWeight / panelWeight) * 100) : 0;
              return (
                <button
                  key={panel.id}
                  type="button"
                  className="knowledge-panel-trigger"
                  onClick={() => openDialog(panel.id)}
                  aria-haspopup="dialog"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{panel.title}</span>
                  <span className="knowledge-panel-mini-track" aria-hidden="true">
                    <i style={{ width: `${panelProgress}%` }} />
                  </span>
                  <strong>{panelProgress}%</strong>
                  <ChevronRight className="size-4 shrink-0 text-indigo-950/35" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {children}

      {selectedPanel ? (
        <div className="panel-modal-overlay">
          <div
            ref={dialogRef}
            className="panel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="閉じる"
              className="panel-modal-close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <p className="text-xs font-black text-indigo-950/45">
              確認できていること・まだ知らないこと
            </p>
            <h2 id={modalTitleId} className="mt-2 text-2xl font-black text-indigo-950">
              {selectedPanel.title}
            </h2>
            {selectedPanel.summary ? (
              <p className="mt-2 text-sm font-bold text-indigo-950/55">{selectedPanel.summary}</p>
            ) : null}
            <ul className="mt-5 grid gap-3">
              {selectedPanel.items.map((item) => {
                const known = isKnown(item);
                return (
                  <li
                    key={item.id}
                    className={known ? "panel-modal-item is-known" : "panel-modal-item"}
                  >
                    <div className="flex items-start gap-3">
                      {known ? (
                        <Check
                          className="mt-0.5 size-5 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                      ) : (
                        <LockKeyhole
                          className="mt-0.5 size-5 shrink-0 text-indigo-950/30"
                          aria-hidden="true"
                        />
                      )}
                      <div>
                        <p className="font-black text-indigo-950">{item.label}</p>
                        <p
                          className={`mt-1 text-sm leading-6 font-medium ${known ? "text-indigo-950/65" : "text-indigo-950/45"}`}
                        >
                          {known
                            ? item.valueText
                            : `未確認：${item.unlockHint ?? "追加情報が必要"}`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {evidence
              .filter((item) => item.panelId === selectedPanel.id)
              .map((item) => (
                <p
                  key={item.id}
                  className="mt-4 flex items-start gap-2 text-xs font-bold text-indigo-950/45"
                >
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    根拠：
                    {item.sourceUrl ? (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline decoration-indigo-950/20 underline-offset-2 hover:text-indigo-950"
                      >
                        {item.sourceLabel}
                        <SquareArrowOutUpRight className="size-3" aria-hidden="true" />
                      </a>
                    ) : (
                      item.sourceLabel
                    )}{" "}
                    / {item.authorName}
                  </span>
                </p>
              ))}
            <button type="button" className="game-button mt-6" onClick={moveToCustomerAi}>
              未確認項目から質問を作る <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {showUnlock && readyPanel ? (
        <div
          ref={dialogRef}
          className="unlock-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={unlockTitleId}
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
        >
          <div className="unlock-dialog">
            <button
              type="button"
              onClick={closeDialog}
              aria-label="閉じる"
              className="panel-modal-close"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <p className="text-xs font-black text-indigo-950/45">情報のアンロック</p>
            <div className="mx-auto mt-5 grid size-20 place-items-center rounded-full border-2 border-indigo-950 bg-yellow-300 shadow-[5px_5px_0_#1e1b4b]">
              <UsersRound className="size-9" aria-hidden="true" />
            </div>
            <h2 id={unlockTitleId} className="mt-6 text-2xl font-black text-indigo-950">
              {readyPanel.title}の情報がつながりました
            </h2>
            <p className="mt-3 text-sm leading-6 font-medium text-indigo-950/65">
              {readyPanel.summary}
            </p>
            <button type="button" className="game-button mx-auto mt-5" onClick={closeDialog}>
              確認する
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
