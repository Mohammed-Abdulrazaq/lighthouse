/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/**
 * @fileoverview This file dislays a screenshot of the page with a particular element being
 * highlighted.
 */

/* globals self RectHelpers */

/** @typedef {import('./dom.js')} DOM */
/** @typedef {LH.Artifacts.Rect} Rect */
/** @typedef {{width: number, height: number}} Size */

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * @param {Rect} highlightRect
 * @param {Size} displayedAreaSize
 * @param {Size} screenshotSize
 */
function getScreenshotPositionDetails(highlightRect, displayedAreaSize, screenshotSize) {
  const highlightCenter = RectHelpers.getRectCenterPoint(highlightRect);

  // Try to center on highlighted area
  const screenshotLeftVisibleEdge = clamp(
    highlightCenter.x - displayedAreaSize.width / 2,
    0, screenshotSize.width - displayedAreaSize.width
  );
  const screenshotTopVisisbleEdge = clamp(
    highlightCenter.y - displayedAreaSize.height / 2,
    0, screenshotSize.height - displayedAreaSize.height
  );

  return {
    screenshotPositionInDisplayArea: {
      left: screenshotLeftVisibleEdge,
      top: screenshotTopVisisbleEdge,
    },
    highlightPositionInDisplayArea: {
      left: highlightRect.left - screenshotLeftVisibleEdge,
      top: highlightRect.top - screenshotTopVisisbleEdge,
    },
  };
}

class ElementScreenshotRenderer {
  /**
   * @param {DOM} dom
   * @param {string} clipId
   * @param {{top: number, bottom: number, left: number, right: number}} _
   */
  static renderClipPath(dom, clipId, {top, bottom, left, right}) {
    const clipPathSvg = dom.createElement('div');
    clipPathSvg.innerHTML = `<svg height="0" width="0">
        <defs>
          <clipPath id='${clipId}' clipPathUnits='objectBoundingBox'>
            <polygon points="0,0  1,0  1,${top} 0,${top}" ></polygon>
            <polygon points="0,${bottom} 1,${bottom} 1,1 0,1" ></polygon>
            <polygon points="0,${top} ${left},${top} ${left},${bottom} 0,${bottom}" ></polygon>
            <polygon points="${right},${top} 1,${top} 1,${bottom} ${right},${bottom}" ></polygon>
          </clipPath>
        </defs>
      </svg>`;
    return clipPathSvg;
  }

  /**
   * @param {DOM} dom
   * @param {ParentNode} templateContext
   * @param {LH.Audit.Details.NodeValue} item
   * @param {LH.Artifacts.FullPageScreenshot} fullPageScreenshot
   * @param {Size} elementSize
   * @return {Element}
   */
  static render(dom, templateContext, item, fullPageScreenshot, elementSize) {
    const fullpageScreenshotUrl = fullPageScreenshot.data;

    const tmpl = dom.cloneTemplate('#tmpl-lh-element-screenshot', templateContext);
    const previewContainer = dom.find('.lh-element-screenshot', tmpl);

    const boundingRect = /** @type {LH.Artifacts.Rect} */ (item.boundingRect);

    let zoomFactor = 1;
    const displayedAreaSize = {
      // width: 420,
      // height: 300,
      width: elementSize.width,
      height: elementSize.height,
    };
    // For large elements zoom out to better show where on the page they are
    if (boundingRect.height > elementSize.height / 2 || /* todo: maybe only apply the width criterium in the preview screenshot */ boundingRect.width > elementSize.width / 2 ) {
      zoomFactor = 0.5;
      displayedAreaSize.width *= 2;
      displayedAreaSize.height *= 2;
    }

    displayedAreaSize.width = Math.min(fullPageScreenshot.width, displayedAreaSize.width);

    const positionDetails = getScreenshotPositionDetails(
      boundingRect,
       displayedAreaSize,
       fullPageScreenshot
    );

    const contentEl = /** @type {HTMLElement} */
      (previewContainer.querySelector('.lh-element-screenshot__content'));
    // contentEl.style.transform = `scale(${zoomFactor})`;
    contentEl.style.top = `-${displayedAreaSize.height * zoomFactor}px`;

    // move to top right
    // contentEl.style.setProperty('top', '0px', 'important');
    // contentEl.style.setProperty('bottom', 'unset', 'important');

    const image = /** @type {HTMLElement} */
      (previewContainer.querySelector('.lh-element-screenshot__image'));
    image.style.width = displayedAreaSize.width * zoomFactor + 'px';
    image.style.height = displayedAreaSize.height * zoomFactor + 'px';


    // todo: figure out how to do this properly, probably just render it once regardless of whether we use the eleme screenshot
    if (!dom.document().querySelector('#full-page-screenshot-style')) {
      const fullPageScreenshotStyleTag = dom.createElement('style');
      fullPageScreenshotStyleTag.id = 'full-page-screenshot-style';
      fullPageScreenshotStyleTag.innerText = `.lh-element-screenshot__image { background-image: url(${fullpageScreenshotUrl}) }`;
      dom.document().body.appendChild(fullPageScreenshotStyleTag);
    }

    image.style.backgroundPositionY = -(positionDetails.screenshotPositionInDisplayArea.top * zoomFactor) + 'px';
    image.style.backgroundPositionX = -(positionDetails.screenshotPositionInDisplayArea.left * zoomFactor) + 'px';
    // image.style.backgroundSize = (zoomFactor * 100) + '%';
    image.style.backgroundSize = `${fullPageScreenshot.width * zoomFactor}px ${fullPageScreenshot.height * zoomFactor}px`;

    const elMarker = /** @type {HTMLElement} */
      (previewContainer.querySelector('.lh-element-screenshot__element-marker'));
    elMarker.style.width = boundingRect.width * zoomFactor + 'px';
    elMarker.style.height = boundingRect.height * zoomFactor + 'px';
    elMarker.style.left = positionDetails.highlightPositionInDisplayArea.left * zoomFactor + 'px';
    elMarker.style.top = positionDetails.highlightPositionInDisplayArea.top * zoomFactor + 'px';

    const mask = /** @type {HTMLElement} */
      (previewContainer.querySelector('.lh-element-screenshot__mask'));
    const clipId = 'clip-' + Math.floor(Math.random() * 100000000);
    mask.style.width = displayedAreaSize.width * zoomFactor + 'px';
    mask.style.height = displayedAreaSize.height * zoomFactor + 'px';
    mask.style.clipPath = 'url(#' + clipId + ')';

    const top = positionDetails.highlightPositionInDisplayArea.top / displayedAreaSize.height;
    const bottom = top + boundingRect.height / displayedAreaSize.height;
    const left = positionDetails.highlightPositionInDisplayArea.left / displayedAreaSize.width;
    const right = left + boundingRect.width / displayedAreaSize.width;
    mask.appendChild(
      ElementScreenshotRenderer.renderClipPath(dom, clipId, {top, bottom, left, right})
    );

    return previewContainer;
  }
}

ElementScreenshotRenderer.getScreenshotPositionDetails = getScreenshotPositionDetails;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElementScreenshotRenderer;
} else {
  self.ElementScreenshotRenderer = ElementScreenshotRenderer;
}
