// @flow

import React, { useCallback, useContext, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList } from 'react-window';
import { ProfilerContext } from './ProfilerContext';
import NoCommitData from './NoCommitData';
import CommitFlamegraphListItem from './CommitFlamegraphListItem';
import { barHeight } from './constants';
import { scale } from './utils';
import { StoreContext } from '../context';

import styles from './CommitFlamegraph.css';

import type { ChartData, ChartNode } from './FlamegraphChartBuilder';
import type { CommitDetailsFrontend, CommitTreeFrontend } from './types';

export type ItemData = {|
  chartData: ChartData,
  scaleX: (value: number, fallbackValue: number) => number,
  selectedChartNode: ChartNode | null,
  selectedChartNodeIndex: number,
  selectFiber: (id: number | null, name: string | null) => void,
  width: number,
|};

export default function CommitFlamegraphAutoSizer(_: {||}) {
  const { profilingCache } = useContext(StoreContext);
  const { rendererID, rootID, selectedCommitIndex, selectFiber } = useContext(
    ProfilerContext
  );

  const deselectCurrentFiber = useCallback(
    event => {
      event.stopPropagation();
      selectFiber(null, null);
    },
    [selectFiber]
  );

  const profilingSummary = profilingCache.ProfilingSummary.read({
    rendererID: ((rendererID: any): number),
    rootID: ((rootID: any): number),
  });

  let commitDetails: CommitDetailsFrontend | null = null;
  let commitTree: CommitTreeFrontend | null = null;
  let chartData: ChartData | null = null;
  if (selectedCommitIndex !== null) {
    commitDetails = profilingCache.CommitDetails.read({
      commitIndex: selectedCommitIndex,
      rendererID: ((rendererID: any): number),
      rootID: ((rootID: any): number),
    });

    commitTree = profilingCache.getCommitTree({
      commitIndex: selectedCommitIndex,
      profilingSummary,
    });

    chartData = profilingCache.getFlamegraphChartData({
      commitDetails,
      commitIndex: selectedCommitIndex,
      commitTree,
    });
  }

  if (
    commitDetails != null &&
    commitTree != null &&
    chartData != null &&
    chartData.depth > 0
  ) {
    return (
      <div className={styles.Container} onClick={deselectCurrentFiber}>
        <AutoSizer>
          {({ height, width }) => (
            // Force Flow types to avoid checking for `null` here because there's no static proof that
            // by the time this render prop function is called, the values of the `let` variables have not changed.
            <CommitFlamegraph
              chartData={((chartData: any): ChartData)}
              commitDetails={((commitDetails: any): CommitDetailsFrontend)}
              commitTree={((commitTree: any): CommitTreeFrontend)}
              height={height}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  } else {
    return <NoCommitData />;
  }
}

type Props = {|
  chartData: ChartData,
  commitDetails: CommitDetailsFrontend,
  commitTree: CommitTreeFrontend,
  height: number,
  width: number,
|};

function CommitFlamegraph({
  chartData,
  commitDetails,
  commitTree,
  height,
  width,
}: Props) {
  const { selectFiber, selectedFiberID } = useContext(ProfilerContext);

  const selectedChartNodeIndex = useMemo<number>(() => {
    if (selectedFiberID === null) {
      return 0;
    }
    // The selected node might not be in the tree for this commit,
    // so it's important that we have a fallback plan.
    const depth = chartData.idToDepthMap.get(selectedFiberID);
    return depth !== undefined ? depth - 1 : 0;
  }, [chartData, selectedFiberID]);

  const selectedChartNode = useMemo(() => {
    let chartNode = null;
    if (selectedFiberID !== null) {
      chartNode = ((chartData.rows[selectedChartNodeIndex].find(
        chartNode => chartNode.id === selectedFiberID
      ): any): ChartNode);
    }
    return chartNode;
  }, [chartData, selectedFiberID, selectedChartNodeIndex]);

  const itemData = useMemo<ItemData>(
    () => ({
      chartData,
      scaleX: scale(
        0,
        selectedChartNode !== null
          ? selectedChartNode.treeBaseDuration
          : chartData.baseDuration,
        0,
        width
      ),
      selectedChartNode,
      selectedChartNodeIndex,
      selectFiber,
      width,
    }),
    [chartData, selectedChartNode, selectedChartNodeIndex, selectFiber, width]
  );

  return (
    <FixedSizeList
      height={height}
      innerElementType="svg"
      itemCount={chartData.depth}
      itemData={itemData}
      itemSize={barHeight}
      width={width}
    >
      {CommitFlamegraphListItem}
    </FixedSizeList>
  );
}
