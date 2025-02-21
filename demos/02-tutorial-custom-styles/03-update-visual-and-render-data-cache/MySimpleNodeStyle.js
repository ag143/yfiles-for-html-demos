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
  Color,
  GeneralPath,
  ILabel,
  INode,
  INodeStyle,
  IRenderContext,
  ITagOwner,
  MutablePoint,
  NodeStyleBase,
  Point,
  SvgVisual
} from 'yfiles'

/**
 * A very simple implementation of an {@link INodeStyle}
 * that uses the convenience class {@link NodeStyleBase}
 * as the base class.
 */
export class MySimpleNodeStyle extends NodeStyleBase {
  constructor() {
    super()
    this.$nodeColor = 'rgba(0,130,180,1)'
    this.$highPerformanceRendering = false
  }

  /**
   * Counts the number of gradient fills used to generate a unique id.
   * @type {number}
   */
  static get fillCounter() {
    MySimpleNodeStyle.$fillCounter = (MySimpleNodeStyle.$fillCounter || 0) + 1
    return MySimpleNodeStyle.$fillCounter
  }

  // //////////////////////////////////////////////////
  // ////////////// New in this sample ////////////////
  // //////////////////////////////////////////////////

  /**
   * Returns whether or not high-performance rendering is used.
   * If set to false, the base implementation of {@link NodeStyleBase.updateVisual} is used which
   * simply calls {@link MySimpleNodeStyle.createVisual}.
   * This property exists only in this sample to show the performance improvement when properly implementing
   * {@link NodeStyleBase.updateVisual}.
   * @type {boolean}
   */
  get highPerformanceRendering() {
    return this.$highPerformanceRendering
  }

  /**
   * Sets whether or not high-performance rendering is used.
   * If set to false, the base implementation of {@link NodeStyleBase.updateVisual} is used which
   * simply calls {@link createVisual}.
   * This property exists only in this sample to show the performance improvement when properly implementing
   * {@link NodeStyleBase.updateVisual}.
   * @type {boolean}
   */
  set highPerformanceRendering(value) {
    this.$highPerformanceRendering = value
  }

  /**
   * Re-renders the node using the old visual for performance reasons.
   * @see Overrides {@link NodeStyleBase.updateVisual}
   * @param {!IRenderContext} context
   * @param {!SvgVisual} oldVisual
   * @param {!INode} node
   * @returns {!SvgVisual}
   */
  updateVisual(context, oldVisual, node) {
    // the following statement is only included to demonstrate the effect of
    // implementing UpdateVisual(). If RecreateVisual is set to false, the base
    // implementation of UpdateVisual() is used which simply calls CreateVisual().
    if (!this.highPerformanceRendering) {
      return super.updateVisual(context, oldVisual, node)
    }

    const container = oldVisual.svgElement
    // get the data with which the oldvisual was created
    const oldCache = container['data-renderDataCache']
    // get the data for the new visual
    const newCache = this.createRenderDataCache(node)

    // check if something changed except for the location of the node
    if (!newCache.equals(newCache, oldCache)) {
      // something changed - re-render the visual
      while (container.lastChild != null) {
        // remove all children
        container.removeChild(container.lastChild)
      }
      this.render(context, node, container, newCache)
    }
    // make sure that the location is up to date
    SvgVisual.setTranslate(container, node.layout.x, node.layout.y)
    return oldVisual
  }

  /**
   * Creates an object containing all necessary data to create a visual for the node.
   * @param {!INode} node
   * @returns {*}
   */
  createRenderDataCache(node) {
    // If Tag is set to a Color, use it as background color of the node
    const color = this.getNodeColor(node)

    // Remember center points of labels to draw label edges, relative the node's top left corner
    const labelLocations = node.labels.toArray().map(label => {
      const center = label.layout.orientedRectangleCenter
      const topLeft = node.layout.topLeft
      return new Point(center.x - topLeft.x, center.y - topLeft.y)
    })
    return {
      color,
      size: node.layout.toSize(),
      labelLocations,
      equals: (self, other) =>
        self.color === other.color &&
        self.size.equals(other.size) &&
        locationsEquals(self.labelLocations, other.labelLocations)
    }

    function locationsEquals(a1, a2) {
      if (a1 === a2) {
        return true
      }
      if (a1 === null || a2 === null || a1.length !== a2.length) {
        return false
      }

      for (let i = 0; i < a1.length; ++i) {
        if (!a1[i].equals(a2[i])) {
          return false
        }
      }
      return true
    }
  }

  // //////////////////////////////////////////////////

  /**
   * Gets the node's color.
   * @type {!string}
   */
  get nodeColor() {
    return this.$nodeColor
  }

  /**
   * Sets the node's color.
   * @type {!string}
   */
  set nodeColor(value) {
    this.$nodeColor = value
  }

  /**
   * Determines the color to use for filling the node.
   * This implementation uses the {@link nodeColor} property unless
   * the {@link ITagOwner.tag} of the {@link INode} is of type {@link Color},
   * in which case that color overrides this style's setting.
   * @param {!INode} node The node to determine the color for.
   * @returns {!string} The color for filling the node.
   */
  getNodeColor(node) {
    // the color can be obtained from the "business data" that can be associated with
    // each node, or use the value from this instance.
    return typeof node.tag === 'string' ? node.tag : this.nodeColor
  }

  /**
   * Creates the visual for a node.
   * @see Overrides {@link NodeStyleBase.createVisual}
   * @param {!IRenderContext} context
   * @param {!INode} node
   * @returns {!SvgVisual}
   */
  createVisual(context, node) {
    // This implementation creates a 'g' element and uses it as a container for the rendering of the node.
    const g = window.document.createElementNS('http://www.w3.org/2000/svg', 'g')
    // Cache the necessary data for rendering of the node
    const cache = this.createRenderDataCache(node)
    // Render the node
    this.render(context, node, g, cache)
    // set the location
    SvgVisual.setTranslate(g, node.layout.x, node.layout.y)
    return new SvgVisual(g)
  }

  /**
   * Actually creates the visual appearance of a node given the values provided by
   * {@link MySimpleNodeStyle.createRenderDataCache}. This renders the node and adds the
   * elements to the `container`. All items are arranged as if the node was located at (0,0).
   * {@link MySimpleNodeStyle.createVisual} and {@link MySimpleNodeStyle.updateVisual} finally arrange the container
   * so that the drawing is translated into the final position.
   * @param {!IRenderContext} context
   * @param {!INode} node
   * @param {!SVGElement} container
   * @param {*} cache
   */
  render(context, node, container, cache) {
    // //////////////////////////////////////////////////
    // ////////////// New in this sample ////////////////
    // //////////////////////////////////////////////////
    // store information with the visual on how we created it
    container['data-renderDataCache'] = cache

    // //////////////////////////////////////////////////

    // Create Defs section in container
    const defs = window.document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    container.appendChild(defs)

    // determine the color to use for the rendering
    const color = cache.color

    // the size of node
    const nodeSize = cache.size

    // add simple drop shadow
    const shadow = window.document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const shadowWidth = nodeSize.width * 0.5
    const shadowHeight = nodeSize.height * 0.5
    shadow.cx.baseVal.value = shadowWidth
    shadow.cy.baseVal.value = shadowHeight
    shadow.rx.baseVal.value = shadowWidth
    shadow.ry.baseVal.value = shadowHeight
    shadow.setAttribute('fill', 'black')
    shadow.setAttribute('fill-opacity', '0.2')
    shadow.setAttribute('transform', 'translate(3 3)')
    container.appendChild(shadow)

    const ellipse = window.document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const w = nodeSize.width * 0.5
    const h = nodeSize.height * 0.5
    ellipse.cx.baseVal.value = w
    ellipse.cy.baseVal.value = h
    ellipse.rx.baseVal.value = w
    ellipse.ry.baseVal.value = h

    // max and min needed for reflection effect calculation
    const max = Math.max(nodeSize.width, nodeSize.height)
    const min = Math.min(nodeSize.width, nodeSize.height)

    if (nodeSize.width > 0 && nodeSize.height > 0) {
      // Create Background gradient from specified background color
      const gradient = window.document.createElementNS(
        'http://www.w3.org/2000/svg',
        'linearGradient'
      )
      gradient.setAttribute('x1', '0')
      gradient.setAttribute('y1', '0')
      gradient.setAttribute('x2', `${0.5 / (nodeSize.width / max)}`)
      gradient.setAttribute('y2', `${1 / (nodeSize.height / max)}`)
      gradient.setAttribute('spreadMethod', 'pad')
      const stop1 = window.document.createElementNS('http://www.w3.org/2000/svg', 'stop')
      stop1.setAttribute('stop-color', 'white')
      stop1.setAttribute('stop-opacity', '0.7')
      stop1.setAttribute('offset', '0')
      const stop2 = window.document.createElementNS('http://www.w3.org/2000/svg', 'stop')
      stop2.setAttribute('stop-color', color)
      stop2.setAttribute('offset', '0.6')
      gradient.appendChild(stop1)
      gradient.appendChild(stop2)

      // creates the gradient id
      const fillId = `MySimpleNodeStyle_fill${MySimpleNodeStyle.fillCounter}`
      // assigns the id
      gradient.id = fillId
      // puts the gradient in the container's defs section
      defs.appendChild(gradient)
      // sets the fill reference in the ellipse
      ellipse.setAttribute('fill', `url(#${fillId})`)
    }

    // Create light reflection effects
    const reflection1 = window.document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const reflection1Size = min / 20
    reflection1.cx.baseVal.value = reflection1Size
    reflection1.cy.baseVal.value = reflection1Size
    reflection1.rx.baseVal.value = reflection1Size
    reflection1.ry.baseVal.value = reflection1Size
    reflection1.setAttribute('fill', 'white')
    const reflection2 = window.document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    const reflection2Size = min / 14
    reflection2.cx.baseVal.value = reflection2Size
    reflection2.cy.baseVal.value = reflection2Size
    reflection2.rx.baseVal.value = reflection2Size
    reflection2.ry.baseVal.value = reflection2Size
    reflection2.setAttribute('fill', 'aliceblue')

    const reflection3Path = new GeneralPath()
    const startPoint = new MutablePoint(nodeSize.width / 2.5, (nodeSize.height / 10) * 9)
    const endPoint = new MutablePoint((nodeSize.width / 10) * 9, nodeSize.height / 2.5)
    const ctrlPoint1 = new MutablePoint(
      startPoint.x + (endPoint.x - startPoint.x) / 2,
      nodeSize.height
    )
    const ctrlPoint2 = new MutablePoint(
      nodeSize.width,
      startPoint.y + (endPoint.y - startPoint.y) / 2
    )
    const ctrlPoint3 = new MutablePoint(ctrlPoint1.x, ctrlPoint1.y - nodeSize.height / 10)
    const ctrlPoint4 = new MutablePoint(ctrlPoint2.x - nodeSize.width / 10, ctrlPoint2.y)

    reflection3Path.moveTo(startPoint)
    reflection3Path.cubicTo(ctrlPoint1, ctrlPoint2, endPoint)
    reflection3Path.cubicTo(ctrlPoint4, ctrlPoint3, startPoint)

    const reflection3 = reflection3Path.createSvgPath()
    reflection3.setAttribute('fill', 'aliceblue')

    // place the reflections
    reflection1.setAttribute('transform', `translate(${nodeSize.width / 5} ${nodeSize.height / 5})`)
    reflection2.setAttribute(
      'transform',
      `translate(${nodeSize.width / 4.9} ${nodeSize.height / 4.9})`
    )
    // and add all to the container for the node
    container.appendChild(ellipse)
    container.appendChild(reflection2)
    container.appendChild(reflection1)
    container.appendChild(reflection3)
  }
}
