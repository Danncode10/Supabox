"use client";

import { useReducer } from "react";
import type { DraftBox } from "@/lib/types";

export interface BoxState {
  boxes: DraftBox[];
  past: DraftBox[][];
  future: DraftBox[][];
  selectedId: string | null;
  /** Increments on every user edit (not on load); drives autosave. */
  rev: number;
}

export type BoxAction =
  | { type: "load"; boxes: DraftBox[] }
  | { type: "select"; id: string | null }
  | { type: "checkpoint" }
  | { type: "live"; boxes: DraftBox[] }
  | { type: "add"; box: DraftBox }
  | { type: "remove"; id: string }
  | { type: "setClass"; id: string; classId: string }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_CAP = 50;
export const initialBoxState: BoxState = { boxes: [], past: [], future: [], selectedId: null, rev: 0 };

function push(past: DraftBox[][], boxes: DraftBox[]) {
  return [...past, boxes].slice(-HISTORY_CAP);
}

function reducer(s: BoxState, a: BoxAction): BoxState {
  switch (a.type) {
    case "load":
      return { ...initialBoxState, boxes: a.boxes };
    case "select":
      return s.selectedId === a.id ? s : { ...s, selectedId: a.id };
    case "checkpoint":
      return { ...s, past: push(s.past, s.boxes), future: [] };
    case "live":
      return { ...s, boxes: a.boxes, rev: s.rev + 1 };
    case "add":
      return { ...s, past: push(s.past, s.boxes), future: [], boxes: [...s.boxes, a.box], selectedId: a.box.id, rev: s.rev + 1 };
    case "remove":
      return {
        ...s,
        past: push(s.past, s.boxes),
        future: [],
        boxes: s.boxes.filter((b) => b.id !== a.id),
        selectedId: s.selectedId === a.id ? null : s.selectedId,
        rev: s.rev + 1,
      };
    case "setClass":
      return {
        ...s,
        past: push(s.past, s.boxes),
        future: [],
        boxes: s.boxes.map((b) => (b.id === a.id ? { ...b, classId: a.classId } : b)),
        rev: s.rev + 1,
      };
    case "undo": {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return {
        ...s,
        boxes: prev,
        past: s.past.slice(0, -1),
        future: [...s.future, s.boxes],
        selectedId: prev.some((b) => b.id === s.selectedId) ? s.selectedId : null,
        rev: s.rev + 1,
      };
    }
    case "redo": {
      if (!s.future.length) return s;
      const next = s.future[s.future.length - 1];
      return {
        ...s,
        boxes: next,
        future: s.future.slice(0, -1),
        past: push(s.past, s.boxes),
        selectedId: next.some((b) => b.id === s.selectedId) ? s.selectedId : null,
        rev: s.rev + 1,
      };
    }
  }
}

export function useBoxHistory() {
  return useReducer(reducer, initialBoxState);
}
