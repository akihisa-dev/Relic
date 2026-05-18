import { tickGraphSimulation } from "../graphLayout";
import type {
  GraphSimulationWorkerRequest,
  GraphSimulationWorkerResponse
} from "../graphSimulationWorkerTypes";

self.onmessage = (event: MessageEvent<GraphSimulationWorkerRequest>): void => {
  const { edges, forceSettings, pinnedPath, points, runId } = event.data;
  const response: GraphSimulationWorkerResponse = {
    points: tickGraphSimulation(points, edges, forceSettings, pinnedPath),
    runId
  };

  self.postMessage(response);
};

export {};
