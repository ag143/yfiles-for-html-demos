/****************************************************************************
 ** @license
 ** This demo file is part of yFiles for HTML 2.5.
 ** Copyright (c) 2000-2023 by yWorks GmbH, Vor dem Kreuzberg 28,
 ** 72070 Tuebingen, Germany. All rights reserved.
 **
 ** yFiles demo files exhibit yFiles for HTML functionalities. Any redistribution
 ** of demo files in source code or binary form, with or without
 ** modification, is not permitted.
 **
 ** Owners of a valid software license for a yFiles for HTML version that this
 ** demo is shipped with are allowed to use the demo source code as basis
 ** for their own yFiles for HTML powered applications. Use of such programs is
 ** governed by the rights and conditions as set out in the yFiles for HTML
 ** license agreement.
 **
 ** THIS SOFTWARE IS PROVIDED ''AS IS'' AND ANY EXPRESS OR IMPLIED
 ** WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 ** MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN
 ** NO EVENT SHALL yWorks BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 ** SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 ** TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 ** PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 ** LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 ** NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 ** SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **
 ***************************************************************************/
import {
  ArcEdgeStyle,
  Arrow,
  ArrowType,
  DefaultLabelStyle,
  DefaultPortCandidate,
  EdgeStyleDecorationInstaller,
  EventRecognizers,
  ExteriorLabelModel,
  ExteriorLabelModelPosition,
  FilteredGraphWrapper,
  FreeNodePortLocationModel,
  GraphComponent,
  GraphEditorInputMode,
  GraphItemTypes,
  GraphMLIOHandler,
  GraphMLSupport,
  GraphOverviewComponent,
  ICommand,
  IEdge,
  IEdgeStyle,
  ILabel,
  ILabelStyle,
  IModelItem,
  INode,
  INodeStyle,
  Insets,
  InteriorLabelModel,
  Key,
  License,
  MouseEventRecognizers,
  NinePositionsEdgeLabelModel,
  Rect,
  StorageLocation,
  StyleDecorationZoomPolicy,
  TreeAnalysis
} from 'yfiles'

import MindmapPopupSupport from './MindmapPopupSupport'
import MindmapGraphModelManager from './MindmapGraphModelManager'
import StateLabelDecorator from './StateLabelDecorator'
import MindmapEdgeStyle from './MindmapEdgeStyle'
import MindmapNodeStyle from './MindmapNodeStyle'
import MindmapNodeStyleRoot from './MindmapNodeStyleRoot'
import CollapseDecorator from './CollapseDecorator'
import { ArcEdgeHandleProvider, SubtreePositionHandler } from './MindmapPositionHandlers'
import type { NodeData } from './MindmapUtil'
import {
  CenterPortCandidateProvider,
  createChild,
  createCrossReferenceEdge,
  getDepth,
  getInEdge,
  getRoot,
  getSubtree,
  isCollapsed,
  isCrossReference,
  isRoot,
  MyArcEdgeStyleRenderer,
  removeSubtree,
  setSubtreeDepths,
  TagChangeUndoUnit
} from './MindmapUtil'
import MindmapEditorInputMode from './MindmapEditorInputMode'
import { bindAction, bindCommand, showApp } from '../../resources/demo-app'
import MindmapOverviewGraphVisualCreator from './MindmapOverviewGraphVisualCreator'
import MindmapLayout from './MindmapLayout'
import DemoCommands from './DemoCommands'
import createGraphMLIOHandler from './GraphMLUtils'

import { applyDemoTheme } from '../../resources/demo-styles'
import { fetchLicense } from '../../resources/fetch-license'

// This demo shows how to implement a Mindmap viewer and editor.
//
// The demo provides the following features:
// - Create and delete nodes using a popup menu or keyboard shortcuts
// - Relocate or delete subtrees
// - Save and load the mindmap
// - Collapse and expand nodes
// - Decorate nodes with state icons
// - Edit the color of nodes
// - Add cross reference edges between nodes

/**
 * The GraphComponent
 */
let graphComponent: GraphComponent = null!

/**
 * The Overview Component
 */
let overviewComponent: GraphOverviewComponent = null!

/**
 * A filtered graph hiding the collapsed nodes.
 */
let filteredGraph: FilteredGraphWrapper = null!

/**
 * The main popup menu.
 */
let nodePopupMain: MindmapPopupSupport = null!

/**
 * The color popup menu.
 */
let nodePopupColor: MindmapPopupSupport = null!

/**
 * The state label icon popup menu.
 */
let nodePopupIcon: MindmapPopupSupport = null!

/**
 * The array of node styles used for nodes at different depths.
 * The style at position i in array is used for nodes at depth i of tree.
 */
let nodeStyles: INodeStyle[] = null!

/**
 * The array of edge styles used for edges at different depths.
 * The style at position i in array is used for edges from depth i to depth i+1 of tree.
 */
let edgeStyles: IEdgeStyle[] = null!

/**
 * The array of label styles used for node labels at different depths.
 * The style at position i in array is used for labels at depth i of tree.
 */
let labelStyles: ILabelStyle[] = null!

/**
 * The subtree root that is dragged.
 */
let movedNode: INode | null = null

/**
 * Holds the old tag data of a node.
 */
let oldTagData: NodeData | null = null

/**
 * Holds the commands and interactions supported by the demo.
 */
let demoCommands: DemoCommands = null!

/**
 * The graphml support.
 */
let gs: GraphMLSupport = null!

/**
 * The GraphML IO Handler
 */
let ioh: GraphMLIOHandler = null!

async function run(): Promise<void> {
  License.value = await fetchLicense()
  // initialize the GraphComponent and GraphOverviewComponent
  graphComponent = new GraphComponent('graphComponent')
  applyDemoTheme(graphComponent)
  overviewComponent = new GraphOverviewComponent('overviewComponent', graphComponent)

  demoCommands = new DemoCommands(graphComponent)

  initializeInputModes()
  initializeGraph()
  initializeNodeStyle()
  initializeEdgeStyle()
  initializeGraphFiltering()
  initializeCanvasOrder()
  initializeNodePopups()
  enableUndo()

  const graph = graphComponent.graph

  // Register selection events
  graphComponent.selection.addItemSelectionChangedListener((sender, evt) => onItemClicked(evt.item))

  // Set maximum zoom factor of viewport to 2.0
  graphComponent.maximumZoom = 2.0

  // Create the IO Handler
  ioh = createGraphMLIOHandler()

  // Enable GraphML support
  enableGraphML()

  // Read the graph
  await readGraph('resources/hobbies.graphml')

  // configure overview panel
  overviewComponent.graphVisualCreator = new MindmapOverviewGraphVisualCreator(graph)

  // Wires up the UI.
  registerCommands()

  showApp(graphComponent, overviewComponent)
}

/**
 * Initializes and customizes the input mode.
 * The mindmap demo uses a customized version of the {@link GraphEditorInputMode} to implement
 * interactions. Various options must be set to custom values to ensure desired behaviour.
 */
function initializeInputModes(): void {
  const graphEditorInputMode = new MindmapEditorInputMode({
    // customize default behaviour
    allowCreateNode: false,
    selectableItems: GraphItemTypes.NODE | GraphItemTypes.EDGE,
    clickableItems: GraphItemTypes.NODE | GraphItemTypes.EDGE | GraphItemTypes.EDGE_LABEL,
    clickSelectableItems: GraphItemTypes.NODE | GraphItemTypes.EDGE,
    movableItems: GraphItemTypes.NODE,
    showHandleItems: GraphItemTypes.EDGE,
    labelEditableItems:
      GraphItemTypes.LABEL_OWNER | GraphItemTypes.NODE_LABEL | GraphItemTypes.EDGE_LABEL,
    deletableItems: GraphItemTypes.NONE,
    allowClipboardOperations: false,
    autoRemoveEmptyLabels: false
  })
  graphEditorInputMode.addItemLeftClickedListener((sender, evt) => onItemClicked(evt.item))
  graphEditorInputMode.addItemDoubleClickedListener((sender, evt) => onItemDoubleClicked(evt.item))
  graphEditorInputMode.addLabelTextChangedListener(async () => {
    adjustNodeBounds()
    await MindmapLayout.instance.layout(graphComponent)
    limitViewport()
  })

  // enable panning without ctrl-key pressed
  graphEditorInputMode.moveViewportInputMode.pressedRecognizer = MouseEventRecognizers.LEFT_DOWN
  graphEditorInputMode.moveInputMode.priority =
    graphEditorInputMode.moveViewportInputMode.priority - 1

  // register handlers for dragging and relocating subtrees
  graphEditorInputMode.moveInputMode.addDragStartedListener(onDragStarted)
  graphEditorInputMode.moveInputMode.addDraggedListener(onDragged)
  graphEditorInputMode.moveInputMode.addDragCanceledListener(onDragCanceled)
  graphEditorInputMode.moveInputMode.addDragFinishedListener(onDragFinished)
  const createEdgeInputMode = graphEditorInputMode.createEdgeInputMode
  // disable CreateEdgeInputMode
  createEdgeInputMode.enabled = false
  createEdgeInputMode.allowCreateBend = false
  // disable CreateEdgeInputMode after cross reference edge has been created
  createEdgeInputMode.addEdgeCreatedListener(() => (createEdgeInputMode.enabled = false))
  createEdgeInputMode.addGestureCanceledListener(() => (createEdgeInputMode.enabled = false))
  // customize edge creation
  createEdgeInputMode.edgeCreator = createCrossReferenceEdge

  disableMultiSelection(graphEditorInputMode)

  graphComponent.inputMode = graphEditorInputMode
}

/**
 * Disables the selection of multiple graph items using mouse/keyboard gestures.
 * Only one item may be selected at a time.
 * @param mode The input mode.
 */
function disableMultiSelection(mode: GraphEditorInputMode): void {
  // disable marquee selection
  mode.marqueeSelectionInputMode.enabled = false
  // disable multi selection with Ctrl-Click
  mode.multiSelectionRecognizer = EventRecognizers.NEVER

  // deactivate commands that can lead to multi selection
  mode.availableCommands.remove(ICommand.TOGGLE_ITEM_SELECTION)
  mode.availableCommands.remove(ICommand.SELECT_ALL)

  mode.navigationInputMode.availableCommands.remove(ICommand.EXTEND_SELECTION_LEFT)
  mode.navigationInputMode.availableCommands.remove(ICommand.EXTEND_SELECTION_UP)
  mode.navigationInputMode.availableCommands.remove(ICommand.EXTEND_SELECTION_DOWN)
  mode.navigationInputMode.availableCommands.remove(ICommand.EXTEND_SELECTION_RIGHT)
}

/**
 * Initializes and customizes graph related functionality.
 */
function initializeGraph(): void {
  // get the node decorator
  const nodeDecorator = graphComponent.graph.decorator.nodeDecorator
  // customize the position handler
  nodeDecorator.positionHandlerDecorator.setImplementationWrapper((item, implementation) => {
    if (getRoot(filteredGraph.wrappedGraph!) !== item) {
      return new SubtreePositionHandler(implementation!)
    }
    return null
  })
  // customize the port candidate provider to ensure that cross reference edges connect to the node center
  nodeDecorator.portCandidateProviderDecorator.setFactory(
    node => new CenterPortCandidateProvider(node)
  )
}

/**
 * Sets the default styles for the nodes.
 */
function initializeNodeStyle(): void {
  nodeStyles = [
    new CollapseDecorator(new MindmapNodeStyleRoot('level0')),
    new CollapseDecorator(new MindmapNodeStyle('level1')),
    new CollapseDecorator(new MindmapNodeStyle('level2'))
  ]
  edgeStyles = [new MindmapEdgeStyle(25, 8), new MindmapEdgeStyle(8, 3), new MindmapEdgeStyle(3, 3)]
  labelStyles = [
    new StateLabelDecorator(new DefaultLabelStyle({ font: '30px Arial' })),
    new StateLabelDecorator(new DefaultLabelStyle({ font: '18px Arial' })),
    new StateLabelDecorator(new DefaultLabelStyle({ font: '16px Arial' }))
  ]
}

/**
 * Runs all initialization required for the custom cross reference edges.
 */
function initializeEdgeStyle(): void {
  const graph = graphComponent.graph

  // disable all edge handles but height handle
  graph.decorator.edgeDecorator.handleProviderDecorator.setFactory(
    edge => new ArcEdgeHandleProvider(edge)
  )

  graph.edgeDefaults.style = new ArcEdgeStyle({
    stroke: '8px #46A8D5',
    height: 50,
    targetArrow: new Arrow({
      fill: '#CA0C3B',
      stroke: '6px #46A8D5',
      type: ArrowType.SHORT
    }),
    provideHeightHandle: true
  })
  // clone the style for each edge
  graph.edgeDefaults.shareStyleInstance = false
  graph.edgeDefaults.labels.layoutParameter = NinePositionsEdgeLabelModel.CENTER_BELOW

  graph.edgeDefaults.labels.style = new DefaultLabelStyle({
    font: '16px Arial',
    backgroundFill: 'white',
    insets: [3, 5, 3, 5]
  })

  // initialize custom edge selection style
  const edgeSelection = graph.decorator.edgeDecorator.selectionDecorator
  edgeSelection.setImplementation(
    new EdgeStyleDecorationInstaller({
      edgeStyle: new ArcEdgeStyle({
        renderer: new MyArcEdgeStyleRenderer(),
        stroke: '8px #f26419',
        height: 50,
        targetArrow: new Arrow({
          fill: '#f26419',
          stroke: '6px #f26419',
          type: ArrowType.SHORT
        })
      }),
      zoomPolicy: StyleDecorationZoomPolicy.WORLD_COORDINATES
    })
  )
}

/**
 * Initializes filtering for hiding nodes.
 */
function initializeGraphFiltering(): void {
  const graph = graphComponent.graph

  filteredGraph = new FilteredGraphWrapper(graph, nodePredicate, (): true => true)
  graphComponent.graph = filteredGraph
}

/**
 * Predicate for the filtered graph wrapper that
 * indicates whether a node should be visible.
 * @param node The node to be tested.
 * @returns True if the node should be visible, false otherwise.
 */
function nodePredicate(node: INode): boolean {
  // return true if none of the parent nodes is collapsed
  const edge = getInEdge(node, filteredGraph.wrappedGraph!)
  if (edge !== null) {
    const parent = edge.sourcePort!.owner as INode
    return (node === movedNode || !isCollapsed(parent)) && nodePredicate(parent)
  }
  return true
}

/**
 * Initializes the visual order of canvas objects.
 */
function initializeCanvasOrder(): void {
  const graphModelManager = new MindmapGraphModelManager(
    graphComponent,
    graphComponent.contentGroup
  )

  // put the group above the node group
  graphModelManager.crossReferenceEdgeGroup.above(graphModelManager.nodeGroup)

  // put edge labels above node labels
  graphModelManager.edgeLabelGroup.above(graphModelManager.nodeLabelGroup)
  graphComponent.graphModelManager = graphModelManager
}

/**
 * Creates and initializes popup menus.
 * There are 3 popup menus:
 *
 * - {@link nodePopupMain Main popup} for general graph commands
 * - {@link nodePopupColor Color popup} to assign a color to a node
 * - {@link nodePopupIcon State icon popup} to assign a state icon to a node
 */
function initializeNodePopups() {
  const nodeLabelModel = new ExteriorLabelModel({ insets: 10 })
  const nodeLabelModelParameter = nodeLabelModel.createParameter(ExteriorLabelModelPosition.NORTH)
  const nodePopupContent = window.document.getElementById('nodePopupContent') as HTMLElement
  nodePopupMain = new MindmapPopupSupport(graphComponent, nodePopupContent, nodeLabelModelParameter)

  nodePopupMain.div.addEventListener('click', () => (nodePopupMain.currentItem = null), false)
  window.document.getElementById('btnSetState')!.addEventListener(
    'click',
    () => {
      nodePopupMain.currentItem = null
      nodePopupIcon.currentItem = graphComponent.currentItem
    },
    false
  )
  window.document.getElementById('btnSetColor')!.addEventListener(
    'click',
    () => {
      nodePopupMain.currentItem = null
      nodePopupColor.currentItem = graphComponent.currentItem
    },
    false
  )
  window.document.getElementById('btnCreateCrossReference')!.addEventListener(
    'click',
    () => {
      if (!MindmapLayout.instance.inLayout) {
        const node = graphComponent.currentItem as INode
        startCrossReferenceEdgeCreation(node)
      }
    },
    false
  )
  window.document.getElementById('btnCreateNode')!.addEventListener(
    'click',
    () => {
      const depth = graphComponent.currentItem!.tag.depth as number
      demoCommands.executeCreateChildren(
        getNodeStyle(depth + 1),
        getEdgeStyle(depth),
        getLabelStyle(depth + 1)
      )
    },
    false
  )
  window.document
    .getElementById('btnDeleteNode')!
    .addEventListener('click', () => demoCommands.executeDeleteItem(), false)
  const nodeLabelModelColor = new ExteriorLabelModel({ insets: 10 })
  const nodeLabelModelColorParameter = nodeLabelModelColor.createParameter(
    ExteriorLabelModelPosition.NORTH
  )

  const nodePopupColorContent = window.document.getElementById('colorPopupContent') as HTMLElement
  nodePopupColor = new MindmapPopupSupport(
    graphComponent,
    nodePopupColorContent,
    nodeLabelModelColorParameter
  )

  const colorContainer = nodePopupColor.div
  colorContainer.addEventListener('click', () => (nodePopupColor.currentItem = null), false)
  // create color popup menu
  const colors = [
    '#FF6C00',
    '#242265',
    '#56926E',
    '#6DBC8D',
    '#6C4F77',
    '#4281A4',
    '#E0E04F',
    '#C1C1C1',
    '#DB3A34',
    '#2D4D3A'
  ]
  colors.forEach(color => {
    const div = window.document.createElement('div')
    div.setAttribute('style', `background-color:${color}`)
    div.setAttribute('class', 'colorButton')
    colorContainer.appendChild(div)
    div.addEventListener(
      'click',
      () => {
        const node = graphComponent.currentItem
        if (node !== null && INode.isInstance(node)) {
          setNodeColor(node, color)
        }
      },
      false
    )
  })

  // state icon popup menu
  const nodeLabelModelIcon = new ExteriorLabelModel({ insets: 10 })
  const nodeLabelModelIconParameter = nodeLabelModelIcon.createParameter(
    ExteriorLabelModelPosition.NORTH
  )

  const nodePopupIconContent = window.document.getElementById('iconPopupContent') as HTMLElement
  nodePopupIcon = new MindmapPopupSupport(
    graphComponent,
    nodePopupIconContent,
    nodeLabelModelIconParameter
  )

  const iconContainer = nodePopupIcon.div
  iconContainer.addEventListener('click', () => (nodePopupIcon.currentItem = null), false)

  StateLabelDecorator.STATE_ICONS.forEach((stateIcon, i) => {
    const div = window.document.createElement('div')
    div.setAttribute('style', `background:url(./resources/${stateIcon}-16.svg)`)
    div.setAttribute('class', 'iconButton')
    iconContainer.appendChild(div)
    div.addEventListener('click', () => demoCommands.onStateLabelClicked(i), false)
  })
}

/**
 * Enables the Undo functionality.
 */
function enableUndo(): void {
  // Enables undo
  graphComponent.graph.undoEngineEnabled = true
}

/**
 * Enables loading and saving the graph to GraphML.
 */
function enableGraphML(): void {
  // Create a new GraphMLSupport instance that handles save and load operations
  gs = new GraphMLSupport({
    graphComponent,
    // configure to load and save to the file system
    storageLocation: StorageLocation.FILE_SYSTEM,
    graphMLIOHandler: ioh
  })
}

/**
 * Reads the given GraphML file. If the loading fails, a default graph will be loaded.
 * @param fileName The file url.
 */
async function readGraph(fileName: string) {
  const graph = graphComponent.graph
  graph.clear()
  try {
    await ioh.readFromURL(graph, fileName)
    graphComponent.graph.nodes.forEach(node => {
      const nodeData = node.tag as NodeData
      node.tag = { ...nodeData }
    })
    // when done - fit the bounds and clear the undo engine
    await onGraphChanged()
  } catch (error) {
    alert(`Unable to open the graph. Perhaps your browser does not allow handling cross domain HTTP requests.
      Please see the demo readme for details: ${error}`)
    loadFallbackGraph()
  }
}

/**
 * Loads the fallback graph if the sample graph couldn't be loaded.
 */
function loadFallbackGraph(): void {
  graphComponent.graph.clear()
  createSampleGraph()
  onGraphChanged()
}

/**
 * Called when the graph has changed.
 */
async function onGraphChanged() {
  graphComponent.updateContentRect()
  graphComponent.fitContent()
  filteredGraph.nodePredicateChanged()
  adjustNodeBounds()
  await MindmapLayout.instance.layout(graphComponent)
  limitViewport()
  graphComponent.fitContent()
  graphComponent.graph.undoEngine!.clear()
}

/**
 * Adjusts all node sizes to fit their labels' preferred size.
 */
function adjustNodeBounds(): void {
  const fullGraph = filteredGraph.wrappedGraph!
  fullGraph.nodes.forEach(node => {
    if (node.labels.size > 0) {
      const label = node.labels.get(0)
      const preferredSize = label.style.renderer.getPreferredSize(label, label.style)
      fullGraph.setLabelPreferredSize(label, preferredSize)
      if (!isRoot(node)) {
        // enlarge bounds
        fullGraph.setNodeLayout(
          node,
          new Rect(node.layout.x, node.layout.y, preferredSize.width + 3, preferredSize.height + 3)
        )
      }
    }
  })
}

/**
 * Sets a ViewportLimiter that makes sure that the explorable region
 * doesn't exceed the graph size.
 */
function limitViewport(): void {
  graphComponent.updateContentRect(new Insets(100))
  const limiter = graphComponent.viewportLimiter
  limiter.honorBothDimensions = false
  limiter.bounds = Rect.add(graphComponent.contentRect, graphComponent.viewport)
}

/**
 * Wires up the UI.
 */
function registerCommands(): void {
  bindAction("button[data-command='Open']", openFile)
  bindAction("button[data-command='Save']", saveFile)

  bindCommand("button[data-command='ZoomIn']", ICommand.INCREASE_ZOOM, graphComponent)
  bindCommand("button[data-command='ZoomOut']", ICommand.DECREASE_ZOOM, graphComponent)
  bindCommand("button[data-command='FitContent']", ICommand.FIT_GRAPH_BOUNDS, graphComponent)
  bindCommand("button[data-command='ZoomOriginal']", ICommand.ZOOM, graphComponent, 1)

  bindCommand("button[data-command='Undo']", ICommand.UNDO, graphComponent)
  bindCommand("button[data-command='Redo']", ICommand.REDO, graphComponent)

  // Register key gestures
  const kim = (graphComponent.inputMode as GraphEditorInputMode).keyboardInputMode
  kim.addKeyBinding({
    key: Key.INSERT,
    execute: (command, parameter, source) => {
      const tag = source.currentItem.tag as NodeData
      demoCommands.executeCreateChildren(
        getNodeStyle(tag.depth + 1),
        getEdgeStyle(tag.depth),
        getLabelStyle(tag.depth + 1)
      )
      return true
    },
    canExecute: _ => demoCommands.canExecuteCreateChildren()
  })

  kim.addKeyBinding({
    key: Key.DELETE,
    execute: _ => {
      hidePopups()
      demoCommands.executeDeleteItem()
      return true
    },
    canExecute: _ => demoCommands.canExecuteDeleteItem()
  })
  kim.addKeyBinding({
    key: Key.ADD,
    execute: _ => demoCommands.executeExpandNode(),
    canExecute: _ => demoCommands.canExecuteExpandNode()
  })
  kim.addKeyBinding({
    key: Key.SUBTRACT,
    execute: _ => demoCommands.executeCollapseNode(),
    canExecute: _ => demoCommands.canExecuteCollapseNode()
  })
  kim.addKeyBinding({
    key: Key.ENTER,
    execute: (command, parameter, source) => {
      const tag = source.currentItem.tag as NodeData
      demoCommands.executeCreateSibling(
        getNodeStyle(tag.depth),
        getEdgeStyle(tag.depth - 1),
        getLabelStyle(tag.depth)
      )
      return true
    },
    canExecute: _ => demoCommands.canExecuteCreateSibling()
  })
}

/**
 * Opens a new graphml file. Only mindmap diagrams that have been created with this demo can be displayed.
 */
async function openFile() {
  try {
    await gs.openFile(filteredGraph.wrappedGraph!)

    const graph = graphComponent.graph
    graph.nodes.forEach(node => {
      const nodeData = node.tag as NodeData
      node.tag = { ...nodeData }
    })

    // check whether the loaded graph is a tree, excluding the cross-reference edges
    try {
      const treeAnalysis = new TreeAnalysis({
        subgraphEdges: e => !isCrossReference(e)
      })
      treeAnalysis.run(graph)
    } catch (err) {
      alert(
        `The input graph is not a tree. Maybe the graph is not created by this demo. Only mindmap diagrams that have been created with this demo can be opened.`
      )
      loadFallbackGraph()
    }
    onGraphChanged()
  } catch (error) {
    alert(
      `Unsupported Diagram File. Only mindmap diagrams that have been created with this demo can be opened: ${error}`
    )
    loadFallbackGraph()
  }
}

/**
 * Saves the current graphml file. The given graph is the full graph so that possible collapsed nodes are also
 * included in the graphml file.
 */
function saveFile(): void {
  gs.saveFile(filteredGraph.wrappedGraph!).catch(error =>
    alert(`Error occurred during saving: ${error}`)
  )
}

/**
 * Sets the color for a node.
 * @param node The node to set the color for.
 * @param color The color to set.
 */
function setNodeColor(node: INode, color: string): void {
  const oldData = node.tag as NodeData
  const newData = { ...oldData, color }
  node.tag = newData

  // create a custom undo unit
  graphComponent.graph.undoEngine!.addUnit(
    new TagChangeUndoUnit('Change Color', 'Change Color', oldData, newData, node, null)
  )
  graphComponent.invalidate()
}

/**
 * Sets the collapsed state of a node.
 * @param node The node to set the collapsed state for.
 * @param collapsed The state to set.
 */
function setCollapsedState(node: INode, collapsed: boolean): void {
  const oldData = node.tag as NodeData
  const newData = { ...oldData, isCollapsed: collapsed }
  node.tag = newData

  // create a custom undo unit
  graphComponent.graph.undoEngine!.addUnit(
    new TagChangeUndoUnit('Collapse/Expand', 'Collapse/Expand', oldData, newData, node, (): void =>
      filteredGraph.nodePredicateChanged()
    )
  )
  // tell the filtered graph to update the graph structure
  filteredGraph.nodePredicateChanged()
}

/**
 * Hides all popups.
 */
function hidePopups(): void {
  nodePopupMain.currentItem = null
  nodePopupColor.currentItem = null
  nodePopupIcon.currentItem = null
}

/**
 * Shows the popup menu when an item is selected.
 * @param item The clicked item
 */
function onItemClicked(item: IModelItem) {
  hidePopups()
  if (INode.isInstance(item) && graphComponent.selection.isSelected(item)) {
    // show or hide pop-up
    nodePopupMain.currentItem = item
  }
}

/**
 * Edits node- or cross reference edge-labels when double-clicking node/edge.
 * @param item The clicked item
 */
function onItemDoubleClicked(item: IModelItem): void {
  if (ILabel.isInstance(item)) {
    item = item.owner!
  }

  if ((INode.isInstance(item) || IEdge.isInstance(item)) && isCrossReference(item as IEdge)) {
    const inputMode = graphComponent.inputMode as GraphEditorInputMode
    if (item.labels.size > 0) {
      inputMode.editLabel(item.labels.get(0))
    } else {
      inputMode.addLabel(item)
    }
  }
}

/**
 * The handler executed when a node drag is started.
 * The selected node is dragged.
 */
function onDragStarted() {
  hidePopups()
  movedNode = graphComponent.selection.selectedNodes.first()
  const oldData = movedNode.tag as NodeData
  oldTagData = { ...oldData }
}

/**
 * The handler executed when a node is dragged.
 * The node's and subtree's style is updated while it is moved.
 */
function onDragged(): void {
  const fullGraph = filteredGraph.wrappedGraph!
  const subtreeEdge = getInEdge(movedNode!, fullGraph)
  if (subtreeEdge !== null) {
    const depth = getDepth(subtreeEdge.sourceNode!)
    setSubtreeDepths(fullGraph, movedNode!, depth + 1)
    updateStyles(movedNode!)
    fullGraph.setStyle(subtreeEdge, getEdgeStyle(depth))
  }
}

/**
 * The handler executed when a node drag is finished.
 * If a new parent candidate was found the subtree is relocated,
 * otherwise the node is deleted.
 */
async function onDragFinished() {
  graphComponent.selection.clear()
  // begin a compound undo operation
  const compoundEdit = graphComponent.graph.beginEdit('Set State Label', 'Set State Label')
  const fullGraph = filteredGraph.wrappedGraph!
  // update styles
  const subtreeEdge = getInEdge(movedNode!, fullGraph)
  if (subtreeEdge !== null) {
    setSubtreeDepths(fullGraph, movedNode!, getDepth(subtreeEdge.sourceNode!) + 1)
    updateStyles(movedNode!)
    adjustNodeBounds()
    setCollapsedState(subtreeEdge.sourceNode!, false)
    const newTagData = movedNode!.tag
    graphComponent.graph.undoEngine!.addUnit(
      new TagChangeUndoUnit(
        'Set State Label',
        'Set State Label',
        oldTagData!,
        newTagData,
        movedNode!,
        node => getSubtree(fullGraph, node).nodes.forEach(n => (n.tag.isLeft = node.tag.isLeft))
      )
    )
  } else {
    // delete gesture
    hidePopups()
    const newTagData = movedNode!.tag
    graphComponent.graph.undoEngine!.addUnit(
      new TagChangeUndoUnit(
        'Set State Label',
        'Set State Label',
        oldTagData!,
        newTagData,
        movedNode!,
        node => filteredGraph.nodePredicateChanged(node)
      )
    )
    removeSubtree(fullGraph, movedNode!)
  }
  await MindmapLayout.instance.layout(graphComponent)
  compoundEdit.commit()
  limitViewport()

  movedNode = null
}

/**
 * The handler executed when a node drag is cancelled.
 */
function onDragCanceled() {
  graphComponent.selection.clear()
  hidePopups()
  const fullGraph = filteredGraph.wrappedGraph!
  const subtreeEdge = getInEdge(movedNode!, fullGraph)
  if (subtreeEdge !== null) {
    setSubtreeDepths(fullGraph, movedNode!, getDepth(subtreeEdge.sourceNode!) + 1)
    updateStyles(movedNode!)
    adjustNodeBounds()
    setCollapsedState(subtreeEdge.sourceNode!, false)
  }
  movedNode = null
}

/**
 * Starts interactive creation of a new cross reference edge.
 * @param node The source node of the new cross reference edge.
 */
function startCrossReferenceEdgeCreation(node: INode): void {
  const inputMode = graphComponent.inputMode as GraphEditorInputMode
  const portCandidate = new DefaultPortCandidate(
    node,
    FreeNodePortLocationModel.NODE_CENTER_ANCHORED
  )
  const createEdgeInputMode = inputMode.createEdgeInputMode
  // enable CreateEdgeInputMode for the moment
  createEdgeInputMode.enabled = true
  createEdgeInputMode.doStartEdgeCreation(portCandidate)
}

/**
 * Updates the styles of a subtree based on the depth information
 * in the nodes' tags.
 * @param subtreeRoot The root node of the subtree.
 */
function updateStyles(subtreeRoot: INode): void {
  const fullGraph = filteredGraph.wrappedGraph!
  const { nodes: subtreeNodes, edges: subtreeEdges } = getSubtree(fullGraph, subtreeRoot)

  subtreeNodes.forEach(node => {
    const depth = getDepth(node)
    const label = node.labels.first()
    const nodeStyle = getNodeStyle(depth)
    const labelStyle = getLabelStyle(depth)
    fullGraph.setStyle(node, nodeStyle)
    fullGraph.setStyle(label, labelStyle)
  })

  subtreeEdges.forEach(edge => {
    const depth = getDepth(edge.sourceNode!)
    const edgeStyle = getEdgeStyle(depth)
    fullGraph.setStyle(edge, edgeStyle)
  })
}

/**
 * Gets the label style based on the depth information
 * in the nodes' tags.
 * @param depth The nodes' depth.
 * @returns The label's style.
 */
function getLabelStyle(depth: number): ILabelStyle {
  const maxStyle = labelStyles.length - 1
  return labelStyles[depth > maxStyle ? maxStyle : depth]
}

/**
 * Gets the node style based on the depth information
 * in the nodes' tags.
 * @param depth The nodes' depth.
 * @returns The node's style.
 */
function getNodeStyle(depth: number): INodeStyle {
  const maxStyle = nodeStyles.length - 1
  return nodeStyles[depth > maxStyle ? maxStyle : depth]
}

/**
 * Gets the edge style based on the depth information.
 * @param depth The nodes' depth.
 * @returns The edge's style.
 */
function getEdgeStyle(depth: number): IEdgeStyle {
  const maxStyle = edgeStyles.length - 1
  return edgeStyles[depth > maxStyle ? maxStyle : depth]
}

/**
 * Creates a sample graph if the original graphml cannot be loaded.
 */
function createSampleGraph(): void {
  const nodeData: NodeData = {
    depth: 0,
    isLeft: false,
    color: '#FFFFFF',
    isCollapsed: false,
    stateIcon: 0
  }
  const fullGraph = filteredGraph.wrappedGraph!
  const n0 = fullGraph.createNode(new Rect(85, 80, 200, 100), getNodeStyle(0), nodeData)
  graphComponent.graph.addLabel(n0, 'Topic', InteriorLabelModel.CENTER, getLabelStyle(0))
  const n1 = createChild(fullGraph, n0, getNodeStyle(1), getEdgeStyle(0), getLabelStyle(1))
  fullGraph.setLabelText(n1.labels.get(0), 'Topic 1')
  const n2 = createChild(fullGraph, n0, getNodeStyle(1), getEdgeStyle(0), getLabelStyle(1))
  fullGraph.setLabelText(n2.labels.get(0), 'Topic 2')
  const n3 = createChild(fullGraph, n0, getNodeStyle(1), getEdgeStyle(0), getLabelStyle(1))
  fullGraph.setLabelText(n3.labels.get(0), 'Topic 3')
  const n11 = createChild(fullGraph, n1, getNodeStyle(2), getEdgeStyle(1), getLabelStyle(2))
  fullGraph.setLabelText(n11.labels.get(0), 'Topic 1.1')
  const n12 = createChild(fullGraph, n1, getNodeStyle(2), getEdgeStyle(1), getLabelStyle(2))
  fullGraph.setLabelText(n12.labels.get(0), 'Topic 1.2')
  const n13 = createChild(fullGraph, n1, getNodeStyle(2), getEdgeStyle(1), getLabelStyle(2))
  fullGraph.setLabelText(n13.labels.get(0), 'Topic 1.3')
}

// noinspection JSIgnoredPromiseFromCall
run()
