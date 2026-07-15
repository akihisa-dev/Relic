import { useCallback, useEffect, useState } from "react";

import {
  defaultGraphOptions,
  type GraphColorGroup,
  type GraphControlSectionId,
  type GraphOptions
} from "../graph/graphTypes";
import { moveGraphColorGroup } from "../graph/graphViewModel";
import {
  graphColorGroupsStorageKey,
  graphControlsStorageKey,
  graphOptionsStorageKey,
  graphSectionCollapsedStorageKey,
  loadGraphColorGroups,
  loadGraphControlsOpen,
  loadGraphOptions,
  loadGraphSectionCollapsed,
  nextGroupColor,
  saveJson
} from "../graph/graphViewRuntime";

export function useGraphControlsState() {
  const [controlsOpen, setControlsOpen] = useState(loadGraphControlsOpen);
  const [options, setOptions] = useState(loadGraphOptions);
  const [colorGroups, setColorGroups] = useState<GraphColorGroup[]>(loadGraphColorGroups);
  const [draggingColorGroupId, setDraggingColorGroupId] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(loadGraphSectionCollapsed);

  useEffect(() => {
    saveJson(graphOptionsStorageKey, options);
  }, [options]);

  useEffect(() => {
    saveJson(graphColorGroupsStorageKey, colorGroups);
  }, [colorGroups]);

  useEffect(() => {
    saveJson(graphControlsStorageKey, controlsOpen);
  }, [controlsOpen]);

  useEffect(() => {
    saveJson(graphSectionCollapsedStorageKey, sectionCollapsed);
  }, [sectionCollapsed]);

  const addColorGroup = useCallback(() => {
    setColorGroups((current) => [
      ...current,
      { color: nextGroupColor(current.length), id: `group-${Date.now()}-${current.length}`, query: "" }
    ]);
  }, []);

  const changeColorGroup = useCallback((groupId: string, patch: Partial<GraphColorGroup>) => {
    setColorGroups((current) => current.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  }, []);

  const deleteColorGroup = useCallback((groupId: string) => {
    setColorGroups((current) => current.filter((group) => group.id !== groupId));
  }, []);

  const endColorGroupDrag = useCallback(() => {
    setDraggingColorGroupId(null);
  }, []);

  const moveColorGroup = useCallback((targetGroupId: string) => {
    setColorGroups((current) => draggingColorGroupId
      ? moveGraphColorGroup(current, draggingColorGroupId, targetGroupId)
      : current);
  }, [draggingColorGroupId]);

  const startColorGroupDrag = useCallback((groupId: string) => {
    setDraggingColorGroupId(groupId);
  }, []);

  const changeOptions = useCallback((patch: Partial<GraphOptions>) => {
    setOptions((current) => ({ ...current, ...patch }));
  }, []);

  const changeSectionCollapsed = useCallback((sectionId: GraphControlSectionId, collapsed: boolean) => {
    setSectionCollapsed((current) => ({ ...current, [sectionId]: collapsed }));
  }, []);

  const toggleControls = useCallback(() => {
    setControlsOpen((current) => !current);
  }, []);

  const resetControls = useCallback(() => {
    setOptions(defaultGraphOptions);
    setColorGroups([]);
  }, []);

  return {
    addColorGroup,
    changeColorGroup,
    changeOptions,
    changeSectionCollapsed,
    colorGroups,
    controlsOpen,
    deleteColorGroup,
    draggingColorGroupId,
    endColorGroupDrag,
    moveColorGroup,
    options,
    resetControls,
    sectionCollapsed,
    startColorGroupDrag,
    toggleControls
  };
}
