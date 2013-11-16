// Last commit: 1f0c355 (2013-09-18 11:01:11 -0400)


(function() {
var get = Ember.get, set = Ember.set;

function samePosition(a, b) {
  return a && b && a.x === b.x && a.y === b.y;
}

function positionElement() {
  var element, position, _position;

  Ember.instrument('view.updateContext.positionElement', this, function() {
    element = get(this, 'element');
    position = get(this, 'position');
    _position = this._position;

    if (!position || !element) { return; }

    // TODO: avoid needing this by avoiding unnecessary
    // calls to this method in the first place
    if (samePosition(position, _position)) { return; }
    this._parentView.applyTransform(element, position.x, position.y);

    this._position = position;
  }, this);
}

Ember.ListItemViewMixin = Ember.Mixin.create({
  init: function(){
    this._super();
    this.one('didInsertElement', positionElement);
  },
  classNames: ['ember-list-item-view'],
  _position: null,
  _positionDidChange: Ember.observer(positionElement, 'position'),
  _positionElement: positionElement
});

})();



(function() {
var get = Ember.get, set = Ember.set;

var backportedInnerString = function(buffer) {
  var content = [], childBuffers = buffer.childBuffers;

  Ember.ArrayPolyfills.forEach.call(childBuffers, function(buffer) {
    var stringy = typeof buffer === 'string';
    if (stringy) {
      content.push(buffer);
    } else {
      buffer.array(content);
    }
  });

  return content.join('');
};

function willInsertElementIfNeeded(view) {
  if (view.willInsertElement) {
    view.willInsertElement();
  }
}

function didInsertElementIfNeeded(view) {
  if (view.didInsertElement) {
    view.didInsertElement();
  }
}

function rerender() {
  var element, buffer, context, hasChildViews;
  element = get(this, 'element');

  if (!element) { return; }

  context = get(this, 'context');

  // releases action helpers in contents
  // this means though that the ListViewItem itself can't use classBindings or attributeBindings
  // need support for rerender contents in ember
  this.triggerRecursively('willClearRender');

  if (this.lengthAfterRender > this.lengthBeforeRender) {
    this.clearRenderedChildren();
    this._childViews.length = this.lengthBeforeRender; // triage bug in ember
  }

  if (context) {
    buffer = Ember.RenderBuffer();
    buffer = this.renderToBuffer(buffer);

    // check again for childViews, since rendering may have added some
    hasChildViews = this._childViews.length > 0;

    if (hasChildViews) {
      this.invokeRecursively(willInsertElementIfNeeded, false);
    }

    element.innerHTML = buffer.innerString ? buffer.innerString() : backportedInnerString(buffer);

    set(this, 'element', element);

    this.transitionTo('inDOM');

    if (hasChildViews) {
      this.invokeRecursively(didInsertElementIfNeeded, false);
    }
  } else {
    element.innerHTML = ''; // when there is no context, this view should be completely empty
  }
}

/**
  The `Ember.ListViewItem` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element
  with `ember-list-item-view` class. It allows you to specify a custom item
  handlebars template for `Ember.ListView`.

  Example:

  ```handlebars
  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.View
  @class ListItemView
  @namespace Ember
*/
Ember.ListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  updateContext: function(newContext){
    var context = get(this, 'context');
    Ember.instrument('view.updateContext.render', this, function() {
      if (context !== newContext) {
        this.set('context', newContext);
        if (newContext instanceof Ember.ObjectController) {
          this.set('controller', newContext);
        }
      }
    }, this);
  },
  rerender: function () { Ember.run.scheduleOnce('render', this, rerender); },
  _contextDidChange: Ember.observer(rerender, 'context', 'controller')
});

})();



(function() {
var get = Ember.get, set = Ember.set;

Ember.ReusableListItemView = Ember.View.extend(Ember.ListItemViewMixin, {
  init: function(){
    this._super();
    this.set('context', Ember.ObjectProxy.create());
  },
  isVisible: Ember.computed('context.content', function(){
    return !!this.get('context.content');
  }),
  updateContext: function(newContext){
    var context = get(this, 'context.content');
    if (context !== newContext) {
      if (this.state === 'inDOM') {
        this.prepareForReuse(newContext);
      }
      set(this, 'context.content', newContext);
    }
  },
  prepareForReuse: Ember.K
});

})();



(function() {
var el = document.createElement('div'), style = el.style;

var propPrefixes = ['Webkit', 'Moz', 'O', 'ms'];

function testProp(prop) {
  if (prop in style) return prop;
  var uppercaseProp = prop.charAt(0).toUpperCase() + prop.slice(1);
  for (var i=0; i<propPrefixes.length; i++) {
    var prefixedProp = propPrefixes[i] + uppercaseProp;
    if (prefixedProp in style) {
      return prefixedProp;
    }
  }
  return null;
}

var transformProp = testProp('transform');
var perspectiveProp = testProp('perspective');

var supports2D = transformProp !== null;
var supports3D = perspectiveProp !== null;

Ember.ListViewHelper = {
  transformProp: transformProp,
  applyTransform: (function(){
    if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })(),
  apply3DTransform: (function(){
    if (supports3D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
      };
    } else if (supports2D) {
      return function(element, x, y){
        element.style[transformProp] = 'translate(' + x + 'px, ' + y + 'px)';
      };
    } else {
      return function(element, x, y){
        element.style.top  = y + 'px';
        element.style.left = x + 'px';
      };
    }
  })()
};

})();



(function() {
var get = Ember.get, set = Ember.set,
min = Math.min, max = Math.max, floor = Math.floor,
ceil = Math.ceil,
forEach = Ember.ArrayPolyfills.forEach;

function addContentArrayObserver() {
  var content = get(this, 'content');
  if (content) {
    content.addArrayObserver(this);
  }
}

function removeAndDestroy(object){
  this.removeObject(object);
  object.destroy();
}

function syncChildViews(){
  Ember.run.once(this, '_syncChildViews');
}

function sortByContentIndex (viewOne, viewTwo){
  return get(viewOne, 'contentIndex') - get(viewTwo, 'contentIndex');
}

function notifyMutationListeners() {
  if (Ember.View.notifyMutationListeners) {
    Ember.run.once(Ember.View, 'notifyMutationListeners');
  }
}

var domManager = Ember.create(Ember.ContainerView.proto().domManager);

domManager.prepend = function(view, html) {
  view.$('.ember-list-container').prepend(html);
  notifyMutationListeners();
};

function syncListContainerWidth(){
  var elementWidth, columnCount, containerWidth, element;

  elementWidth = get(this, 'elementWidth');
  columnCount = get(this, 'columnCount');
  containerWidth = elementWidth * columnCount;
  element = this.$('.ember-list-container');

  if (containerWidth && element) {
    element.css('width', containerWidth);
  }
}

function enableProfilingOutput() {
  function before(name, time, payload) {
    console.time(name);
  }

  function after (name, time, payload) {
    console.timeEnd(name);
  }

  if (Ember.ENABLE_PROFILING) {
    Ember.subscribe('view._scrollContentTo', {
      before: before,
      after: after
    });
    Ember.subscribe('view.updateContext', {
      before: before,
      after: after
    });
  }
}

/**
  @class Ember.ListViewMixin
  @namespace Ember
*/
Ember.ListViewMixin = Ember.Mixin.create({
  itemViewClass: Ember.ListItemView,
  emptyViewClass: Ember.View,
  classNames: ['ember-list-view'],
  attributeBindings: ['style'],
  domManager: domManager,
  scrollTop: 0,
  bottomPadding: 0,
  _lastEndingIndex: 0,
  paddingCount: 1,

  /**
    @private

    Setup a mixin.
    - adding observer to content array
    - creating child views based on height and length of the content array

    @method init
  */
  init: function() {
    this._super();
    this.on('didInsertElement', syncListContainerWidth);
    this.columnCountDidChange();
    this._syncChildViews();
    this._addContentArrayObserver();
  },

  _addContentArrayObserver: Ember.beforeObserver(function() {
    addContentArrayObserver.call(this);
  }, 'content'),

  /**
    Called on your view when it should push strings of HTML into a
    `Ember.RenderBuffer`.

    Adds a [div](https://developer.mozilla.org/en-US/docs/HTML/Element/div)
    with a required `ember-list-container` class.

    @method render
    @param {Ember.RenderBuffer} buffer The render buffer
  */
  render: function(buffer) {
    buffer.push('<div class="ember-list-container">');
    this._super(buffer);
    buffer.push('</div>');
  },

  willInsertElement: function() {
    if (!this.get("height") || !this.get("rowHeight")) {
      throw "A ListView must be created with a height and a rowHeight.";
    }
    this._super();
  },

  /**
    @private

    Sets inline styles of the view:
    - height
    - width
    - position
    - overflow
    - -webkit-overflow
    - overflow-scrolling

    Called while attributes binding.

    @property {Ember.ComputedProperty} style
  */
  style: Ember.computed('height', 'width', function() {
    var height, width, style, css;

    height = get(this, 'height');
    width = get(this, 'width');
    css = get(this, 'css');

    style = '';

    if (height) { style += 'height:' + height + 'px;'; }
    if (width)  { style += 'width:'  + width  + 'px;'; }

    for ( var rule in css ){
      if (css.hasOwnProperty(rule)) {
        style += rule + ':' + css[rule] + ';';
      }
    }

    return style;
  }),

  /**
    @private

    Performs visual scrolling. Is overridden in Ember.ListView.

    @method scrollTo
  */
  scrollTo: function(y) {
    throw 'must override to perform the visual scroll and effectively delegate to _scrollContentTo';
  },

  /**
    @private

    Internal method used to force scroll position

    @method scrollTo
  */
  _scrollTo: Ember.K,

  /**
    @private
    @method _scrollContentTo
  */
  _scrollContentTo: function(y) {
    var startingIndex, endingIndex,
        contentIndex, visibleEndingIndex, maxContentIndex,
        contentIndexEnd, contentLength, scrollTop;

    scrollTop = max(0, y);

    Ember.instrument('view._scrollContentTo', {
      scrollTop: scrollTop,
      content: get(this, 'content'),
      startingIndex: this._startingIndex(),
      endingIndex: min(max(get(this, 'content.length') - 1, 0), this._startingIndex() + this._numChildViewsForViewport())
    }, function () {
      contentLength = get(this, 'content.length');
      set(this, 'scrollTop', scrollTop);

      maxContentIndex = max(contentLength - 1, 0);

      startingIndex = this._startingIndex();
      visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

      endingIndex = min(maxContentIndex, visibleEndingIndex);

      this.trigger('scrollYChanged', y);

      if (startingIndex === this._lastStartingIndex &&
          endingIndex === this._lastEndingIndex) {
        return;
      }

      this._reuseChildren();

      this._lastStartingIndex = startingIndex;
      this._lastEndingIndex = endingIndex;
    }, this);
  },

  /**
    @private

    Computes the height for a `Ember.ListView` scrollable container div.
    You must specify `rowHeight` parameter for the height to be computed properly.

    @property {Ember.ComputedProperty} totalHeight
  */
  totalHeight: Ember.computed('content.length', 'rowHeight', 'columnCount', 'bottomPadding', function() {
    var contentLength, rowHeight, columnCount, bottomPadding;

    contentLength = get(this, 'content.length');
    rowHeight = get(this, 'rowHeight');
    columnCount = get(this, 'columnCount');
    bottomPadding = get(this, 'bottomPadding');

    return ((ceil(contentLength / columnCount)) * rowHeight) + bottomPadding;
  }),

  /**
    @private
    @method _prepareChildForReuse
  */
  _prepareChildForReuse: function(childView) {
    childView.prepareForReuse();
  },

  /**
    @private
    @method _reuseChildForContentIndex
  */
  _reuseChildForContentIndex: function(childView, contentIndex) {
    var content, context, newContext, childsCurrentContentIndex, position, enableProfiling;

    content = get(this, 'content');
    enableProfiling = get(this, 'enableProfiling');
    position = this.positionForIndex(contentIndex);
    set(childView, 'position', position);

    set(childView, 'contentIndex', contentIndex);

    if (enableProfiling) {
      Ember.instrument('view._reuseChildForContentIndex', position, function(){}, this);
    }

    newContext = content.objectAt(contentIndex);
    childView.updateContext(newContext);
  },

  /**
    @private
    @method positionForIndex
  */
  positionForIndex: function(index){
    var elementWidth, width, columnCount, rowHeight, y, x;

    elementWidth = get(this, 'elementWidth') || 1;
    width = get(this, 'width') || 1;
    columnCount = get(this, 'columnCount');
    rowHeight = get(this, 'rowHeight');

    y = (rowHeight * floor(index/columnCount));
    x = (index % columnCount) * elementWidth;

    return {
      y: y,
      x: x
    };
  },

  /**
    @private
    @method _childViewCount
  */
  _childViewCount: function() {
    var contentLength, childViewCountForHeight;

    contentLength = get(this, 'content.length');
    childViewCountForHeight = this._numChildViewsForViewport();

    return min(contentLength, childViewCountForHeight);
  },

  /**
    @private

    Returns a number of columns in the Ember.ListView (for grid layout).

    If you want to have a multi column layout, you need to specify both
    `width` and `elementWidth`.

    If no `elementWidth` is specified, it returns `1`. Otherwise, it will
    try to fit as many columns as possible for a given `width`.

    @property {Ember.ComputedProperty} columnCount
  */
  columnCount: Ember.computed('width', 'elementWidth', function() {
    var elementWidth, width, count;

    elementWidth = get(this, 'elementWidth');
    width = get(this, 'width');

    if (elementWidth) {
      count = floor(width / elementWidth);
    } else {
      count = 1;
    }

    return count;
  }),

  /**
    @private

    Fires every time column count is changed.

    @event columnCountDidChange
  */
  columnCountDidChange: Ember.observer(function(){
    var ratio, currentScrollTop, proposedScrollTop, maxScrollTop,
        scrollTop, lastColumnCount, newColumnCount, element;

    lastColumnCount = this._lastColumnCount;

    currentScrollTop = get(this, 'scrollTop');
    newColumnCount = get(this, 'columnCount');
    maxScrollTop = get(this, 'maxScrollTop');
    element = get(this, 'element');

    this._lastColumnCount = newColumnCount;

    if (lastColumnCount) {
      ratio = (lastColumnCount / newColumnCount);
      proposedScrollTop = currentScrollTop * ratio;
      scrollTop = min(maxScrollTop, proposedScrollTop);

      this._scrollTo(scrollTop);
      set(this, 'scrollTop', scrollTop);
    }

    if (arguments.length > 0) {
      // invoked by observer
      Ember.run.schedule('afterRender', this, syncListContainerWidth);
    }
  }, 'columnCount'),

  /**
    @private

    Computes max possible scrollTop value given the visible viewport
    and scrollable container div height.

    @property {Ember.ComputedProperty} maxScrollTop
  */
  maxScrollTop: Ember.computed('height', 'totalHeight', function(){
    var totalHeight, viewportHeight;

    totalHeight = get(this, 'totalHeight');
    viewportHeight = get(this, 'height');

    return max(0, totalHeight - viewportHeight);
  }),

  /**
    @private

    Computes the number of views that would fit in the viewport area.
    You must specify `height` and `rowHeight` parameters for the number of
    views to be computed properly.

    @method _numChildViewsForViewport
  */
  _numChildViewsForViewport: function() {
    var height, rowHeight, paddingCount, columnCount;

    height = get(this, 'height');
    rowHeight = get(this, 'rowHeight');
    paddingCount = get(this, 'paddingCount');
    columnCount = get(this, 'columnCount');

    return (ceil(height / rowHeight) * columnCount) + (paddingCount * columnCount);
  },

  /**
    @private

    Computes the starting index of the item views array.
    Takes `scrollTop` property of the element into account.

    Is used in `_syncChildViews`.

    @method _startingIndex
  */
  _startingIndex: function() {
    var scrollTop, rowHeight, columnCount, calculatedStartingIndex,
        contentLength, largestStartingIndex;

    contentLength = get(this, 'content.length');
    scrollTop = get(this, 'scrollTop');
    rowHeight = get(this, 'rowHeight');
    columnCount = get(this, 'columnCount');

    calculatedStartingIndex = floor(scrollTop / rowHeight) * columnCount;

    largestStartingIndex = max(contentLength - 1, 0);

    return min(calculatedStartingIndex, largestStartingIndex);
  },

  /**
    @private
    @event contentWillChange
  */
  contentWillChange: Ember.beforeObserver(function() {
    var content;

    content = get(this, 'content');

    if (content) {
      content.removeArrayObserver(this);
    }
  }, 'content'),

  /**),
    @private
    @event contentDidChange
  */
  contentDidChange: Ember.observer(function() {
    addContentArrayObserver.call(this);
    syncChildViews.call(this);
  }, 'content'),

  /**
    @private
    @property {Function} needsSyncChildViews
  */
  needsSyncChildViews: Ember.observer(syncChildViews, 'height', 'width', 'columnCount'),

  /**
    @private

    Returns a new item view. Takes `contentIndex` to set the context
    of the returned view properly.

    @param {Number} contentIndex item index in the content array
    @method _addItemView
  */
  _addItemView: function(contentIndex){
    var itemViewClass, childView;

    itemViewClass = get(this, 'itemViewClass');
    childView = this.createChildView(itemViewClass);

    this.pushObject(childView);
   },

  /**
    @private

    Intelligently manages the number of childviews.

    @method _syncChildViews
   **/
  _syncChildViews: function(){
    var itemViewClass, startingIndex, childViewCount,
        endingIndex, numberOfChildViews, numberOfChildViewsNeeded,
        childViews, count, delta, index, childViewsLength, contentIndex;

    if (get(this, 'isDestroyed') || get(this, 'isDestroying')) {
      return;
    }

    childViewCount = this._childViewCount();
    childViews = this.positionOrderedChildViews();

    startingIndex = this._startingIndex();
    endingIndex = startingIndex + childViewCount;

    numberOfChildViewsNeeded = childViewCount;
    numberOfChildViews = childViews.length;

    delta = numberOfChildViewsNeeded - numberOfChildViews;

    if (delta === 0) {
      // no change
    } else if (delta > 0) {
      // more views are needed
      contentIndex = this._lastEndingIndex;

      for (count = 0; count < delta; count++, contentIndex++) {
        this._addItemView(contentIndex);
      }

    } else {
      // less views are needed
      forEach.call(
        childViews.splice(numberOfChildViewsNeeded, numberOfChildViews),
        removeAndDestroy,
        this
      );
    }

    this._scrollContentTo(get(this, 'scrollTop'));

    // if _scrollContentTo short-circuits, we still need
    // to call _reuseChildren to get new views positioned
    // and rendered correctly
    this._reuseChildren();

    this._lastStartingIndex = startingIndex;
    this._lastEndingIndex   = this._lastEndingIndex + delta;
  },

  /**
    @private
    @method _reuseChildren
  */
  _reuseChildren: function(){
    var contentLength, childViews, childViewsLength,
        startingIndex, endingIndex, childView, attrs,
        contentIndex, visibleEndingIndex, maxContentIndex,
        contentIndexEnd, scrollTop;

    scrollTop = get(this, 'scrollTop');
    contentLength = get(this, 'content.length');
    maxContentIndex = max(contentLength - 1, 0);
    childViews = this._childViews;
    childViewsLength =  childViews.length;

    startingIndex = this._startingIndex();
    visibleEndingIndex = startingIndex + this._numChildViewsForViewport();

    endingIndex = min(maxContentIndex, visibleEndingIndex);

    this.trigger('scrollContentTo', scrollTop);

    contentIndexEnd = min(visibleEndingIndex, startingIndex + childViewsLength);

    for (contentIndex = startingIndex; contentIndex < contentIndexEnd; contentIndex++) {
      childView = childViews[contentIndex % childViewsLength];
      this._reuseChildForContentIndex(childView, contentIndex);
    }
  },

  /**
    @private
    @method positionOrderedChildViews
  */
  positionOrderedChildViews: function() {
    return this._childViews.sort(sortByContentIndex);
  },

  arrayWillChange: Ember.K,

  /**
    @private
    @event arrayDidChange
  */
  // TODO: refactor
  arrayDidChange: function(content, start, removedCount, addedCount) {
    var index, contentIndex;

    if (this.state === 'inDOM') {
      // ignore if all changes are out of the visible change
      if( start >= this._lastStartingIndex || start < this._lastEndingIndex) {
        index = 0;
        // ignore all changes not in the visible range
        // this can re-position many, rather then causing a cascade of re-renders
        forEach.call(
          this.positionOrderedChildViews(),
          function(childView) {
            contentIndex = this._lastStartingIndex + index;
            this._reuseChildForContentIndex(childView, contentIndex);
            index++;
          },
          this
        );
      }

      syncChildViews.call(this);
    }
  }
});

})();



(function() {
var get = Ember.get, set = Ember.set;

/**
  The `Ember.ListView` view class renders a
  [div](https://developer.mozilla.org/en/HTML/Element/div) HTML element,
  with `ember-list-view` class.

  The context of each item element within the `Ember.ListView` are populated
  from the objects in the `Element.ListView`'s `content` property.

  ### `content` as an Array of Objects

  The simplest version of an `Ember.ListView` takes an array of object as its
  `content` property. The object will be used as the `context` each item element
  inside the rendered `div`.

  Example:

  ```javascript
  App.contributors = [{ name: 'Stefan Penner' }, { name: 'Alex Navasardyan' }, { name: 'Rey Cohen'}];
  ```

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  Would result in the following HTML:

  ```html
   <div id="ember181" class="ember-view ember-list-view" style="height:500px;width:500px;position:relative;overflow:scroll;-webkit-overflow-scrolling:touch;overflow-scrolling:touch;">
    <div class="ember-list-container">
      <div id="ember186" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 0px, 0);">
        <script id="metamorph-0-start" type="text/x-placeholder"></script>Stefan Penner<script id="metamorph-0-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember187" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 50px, 0);">
        <script id="metamorph-1-start" type="text/x-placeholder"></script>Alex Navasardyan<script id="metamorph-1-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember188" class="ember-view ember-list-item-view" style="-webkit-transform: translate3d(0px, 100px, 0);">
        <script id="metamorph-2-start" type="text/x-placeholder"></script>Rey Cohen<script id="metamorph-2-end" type="text/x-placeholder"></script>
      </div>
      <div id="ember189" class="ember-view ember-list-scrolling-view" style="height: 150px"></div>
    </div>
  </div>
  ```

  By default `Ember.ListView` provides support for `height`,
  `rowHeight`, `width`, `elementWidth`, `scrollTop` parameters.

  Note, that `height` and `rowHeight` are required parameters.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50}}
    {{name}}
  {{/collection}}
  ```

  If you would like to have multiple columns in your view layout, you can
  set `width` and `elementWidth` parameters respectively.

  ```handlebars
  {{#collection Ember.ListView contentBinding="App.contributors" height=500 rowHeight=50 width=500 elementWidth=80}}
    {{name}}
  {{/collection}}
  ```

  ### extending `Ember.ListView`

  Example:

  ```handlebars
  {{view App.ListView contentBinding="content"}}

  <script type="text/x-handlebars" data-template-name="row_item">
    {{name}}
  </script>
  ```

  ```javascript
  App.ListView = Ember.ListView.extend({
    height: 500,
    width: 500,
    elementWidth: 80,
    rowHeight: 20,
    itemViewClass: Ember.ListItemView.extend({templateName: "row_item"})
  });
  ```

  @extends Ember.ContainerView
  @class ListView
  @namespace Ember
*/
Ember.ListView = Ember.ContainerView.extend(Ember.ListViewMixin, {
  css: {
    position: 'relative',
    overflow: 'scroll',
    '-webkit-overflow-scrolling': 'touch',
    'overflow-scrolling': 'touch'
  },

  applyTransform: Ember.ListViewHelper.applyTransform,

  _scrollTo: function(scrollTop) {
    var element = get(this, 'element');

    if (element) { element.scrollTop = scrollTop; }
  },

  didInsertElement: function() {
    var that, element;

    that = this,
    element = get(this, 'element');

    this._updateScrollableHeight();

    this._scroll = function(e) { that.scroll(e); };

    Ember.$(element).on('scroll', this._scroll);
  },

  willDestroyElement: function() {
    var element;

    element = get(this, 'element');

    Ember.$(element).off('scroll', this._scroll);
  },

  scroll: function(e) {
    Ember.run(this, this.scrollTo, e.target.scrollTop);
  },

  scrollTo: function(y){
    var element = get(this, 'element');
    this._scrollTo(y);
    this._scrollContentTo(y);
  },

  totalHeightDidChange: Ember.observer(function () {
    Ember.run.scheduleOnce('afterRender', this, this._updateScrollableHeight);
  }, 'totalHeight'),

  _updateScrollableHeight: function () {
    if (this.state === 'inDOM') {
      this.$('.ember-list-container').css({
        height: get(this, 'totalHeight')
      });
    }
  }
});

})();



(function() {
var fieldRegex = /input|textarea|select/i,
  hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof window.DocumentTouch,
  handleStart, handleMove, handleEnd, handleCancel,
  startEvent, moveEvent, endEvent, cancelEvent;
if (hasTouch) {
  startEvent = 'touchstart';
  handleStart = function (e) {
    var touch = e.touches[0],
      target = touch && touch.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll(e.touches, e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'touchmove';
  handleMove = function (e) {
    this.continueScroll(e.touches, e.timeStamp);
  };
  endEvent = 'touchend';
  handleEnd = function (e) {
    // if we didn't end up scrolling we need to
    // synthesize click since we did e.preventDefault()
    // on touchstart
    if (!this._isScrolling) {
      synthesizeClick(e);
    }
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'touchcancel';
  handleCancel = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
} else {
  startEvent = 'mousedown';
  handleStart = function (e) {
    if (e.which !== 1) return;
    var target = e.target;
    // avoid e.preventDefault() on fields
    if (target && fieldRegex.test(target.tagName)) {
      return;
    }
    bindWindow(this.scrollerEventHandlers);
    this.willBeginScroll([e], e.timeStamp);
    e.preventDefault();
  };
  moveEvent = 'mousemove';
  handleMove = function (e) {
    this.continueScroll([e], e.timeStamp);
  };
  endEvent = 'mouseup';
  handleEnd = function (e) {
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
  cancelEvent = 'mouseout';
  handleCancel = function (e) {
    if (e.relatedTarget) return;
    unbindWindow(this.scrollerEventHandlers);
    this.endScroll(e.timeStamp);
  };
}

function handleWheel(e) {
  this.mouseWheel(e);
  e.preventDefault();
}

function bindElement(el, handlers) {
  el.addEventListener(startEvent, handlers.start, false);
  el.addEventListener('mousewheel', handlers.wheel, false);
}

function unbindElement(el, handlers) {
  el.removeEventListener(startEvent, handlers.start, false);
  el.removeEventListener('mousewheel', handlers.wheel, false);
}

function bindWindow(handlers) {
  window.addEventListener(moveEvent, handlers.move, true);
  window.addEventListener(endEvent, handlers.end, true);
  window.addEventListener(cancelEvent, handlers.cancel, true);
}

function unbindWindow(handlers) {
  window.removeEventListener(moveEvent, handlers.move, true);
  window.removeEventListener(endEvent, handlers.end, true);
  window.removeEventListener(cancelEvent, handlers.cancel, true);
}

Ember.VirtualListScrollerEvents = Ember.Mixin.create({
  init: function() {
    this.on('didInsertElement', this, 'bindScrollerEvents');
    this.on('willDestroyElement', this, 'unbindScrollerEvents');
    this.scrollerEventHandlers = {
      start: bind(this, handleStart),
      move: bind(this, handleMove),
      end: bind(this, handleEnd),
      cancel: bind(this, handleCancel),
      wheel: bind(this, handleWheel)
    };
    return this._super();
  },
  bindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    bindElement(el, handlers);
  },
  unbindScrollerEvents: function() {
    var el = this.get('element'),
      handlers = this.scrollerEventHandlers;
    unbindElement(el, handlers);
    unbindWindow(handlers);
  }
});

function bind(view, handler) {
  return function (evt) {
    handler.call(view, evt);
  };
}

function synthesizeClick(e) {
  var point = e.changedTouches[0],
    target = point.target,
    ev;
  if (target && fieldRegex.test(target.tagName)) {
    ev = document.createEvent('MouseEvents');
    ev.initMouseEvent('click', true, true, e.view, 1, point.screenX, point.screenY, point.clientX, point.clientY, e.ctrlKey, e.altKey, e.shiftKey, e.metaKey, 0, null);
    return target.dispatchEvent(ev);
  }
}

})();



(function() {
/*global Scroller*/
var max = Math.max, get = Ember.get, set = Ember.set;

function updateScrollerDimensions(target) {
  var width, height, totalHeight;

  target = target || this;

  width = get(target, 'width');
  height = get(target, 'height');
  totalHeight = get(target, 'totalHeight');

  target.scroller.setDimensions(width, height, width, totalHeight);
  target.trigger('scrollerDimensionsDidChange');
}

/**
  VirtualListView

  @class VirtualListView
  @namespace Ember
*/
Ember.VirtualListView = Ember.ContainerView.extend(Ember.ListViewMixin, Ember.VirtualListScrollerEvents, {
  _isScrolling: false,
  _mouseWheel: null,
  css: {
    position: 'relative',
    overflow: 'hidden'
  },

  init: function(){
    this._super();
    this.setupScroller();
  },
  _scrollerTop: 0,
  applyTransform: Ember.ListViewHelper.apply3DTransform,

  setupScroller: function(){
    var view, y;

    view = this;

    view.scroller = new Scroller(function(left, top, zoom) {
      if (view.state !== 'inDOM') { return; }

      if (view.listContainerElement) {
        view.applyTransform(view.listContainerElement, 0, -top);
        view._scrollerTop = top;
        view._scrollContentTo(top);
      }
    }, {
      scrollingX: false,
      scrollingComplete: function(){
        view.trigger('scrollingDidComplete');
      }
    });

    view.trigger('didInitializeScroller');
    updateScrollerDimensions(view);
  },

  scrollerDimensionsNeedToChange: Ember.observer(function() {
    Ember.run.once(this, updateScrollerDimensions);
  }, 'width', 'height', 'totalHeight'),

  didInsertElement: function() {
    this.listContainerElement = this.$('> .ember-list-container')[0];
  },

  willBeginScroll: function(touches, timeStamp) {
    this._isScrolling = false;
    this.trigger('scrollingDidStart');

    this.scroller.doTouchStart(touches, timeStamp);
  },

  continueScroll: function(touches, timeStamp) {
    var startingScrollTop, endingScrollTop, event;

    if (this._isScrolling) {
      this.scroller.doTouchMove(touches, timeStamp);
    } else {
      startingScrollTop = this._scrollerTop;

      this.scroller.doTouchMove(touches, timeStamp);

      endingScrollTop = this._scrollerTop;

      if (startingScrollTop !== endingScrollTop) {
        event = Ember.$.Event("scrollerstart");
        Ember.$(touches[0].target).trigger(event);

        this._isScrolling = true;
      }
    }
  },

  endScroll: function(timeStamp) {
    this.scroller.doTouchEnd(timeStamp);
  },

  // api
  scrollTo: function(y, animate) {
    if (animate === undefined) {
      animate = true;
    }

    this.scroller.scrollTo(0, y, animate, 1);
  },

  // events
  mouseWheel: function(e){
    var inverted, delta, candidatePosition;

    inverted = e.webkitDirectionInvertedFromDevice;
    delta = e.wheelDeltaY * (inverted ? 0.8 : -0.8);
    candidatePosition = this.scroller.__scrollTop + delta;

    if ((candidatePosition >= 0) && (candidatePosition <= this.scroller.__maxScrollTop)) {
      this.scroller.scrollBy(0, delta, true);
    }

    return false;
  }
});

})();



(function() {

})();

(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A form to create an IP address that will be blocked or whitelisted.
  Example usage:

    {{screened-ip-address-form action="recordAdded"}}

  where action is a callback on the controller or route that will get called after
  the new record is successfully saved. It is called with the new ScreenedIpAddress record
  as an argument.

  @class ScreenedIpAddressFormComponent
  @extends Ember.Component
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedIpAddressFormComponent = Ember.Component.extend({
  classNames: ['screened-ip-address-form'],
  formSubmitted: false,
  actionName: 'block',

  actionNames: function() {
    return [
      {id: 'block',       name: I18n.t('admin.logs.screened_ips.actions.block')},
      {id: 'do_nothing',  name: I18n.t('admin.logs.screened_ips.actions.do_nothing')}
    ];
  }.property(),

  actions: {
    submit: function() {
      if (!this.get('formSubmitted')) {
        var self = this;
        this.set('formSubmitted', true);
        var screenedIpAddress = Discourse.ScreenedIpAddress.create({ip_address: this.get('ip_address'), action_name: this.get('actionName')});
        screenedIpAddress.save().then(function(result) {
          self.set('ip_address', '');
          self.set('formSubmitted', false);
          self.sendAction('action', Discourse.ScreenedIpAddress.create(result.screened_ip_address));
          Em.run.schedule('afterRender', function() { self.$('.ip-address-input').focus(); });
        }, function(e) {
          self.set('formSubmitted', false);
          var msg;
          if (e.responseJSON && e.responseJSON.errors) {
            msg = I18n.t("generic_error_with_reason", {error: e.responseJSON.errors.join('. ')});
          } else {
            msg = I18n.t("generic_error");
          }
          bootbox.alert(msg, function() { self.$('.ip-address-input').focus(); });
        });
      }
    }
  },

  didInsertElement: function(e) {
    var self = this;
    this._super();
    Em.run.schedule('afterRender', function() {
      self.$('.ip-address-input').keydown(function(e) {
        if (e.keyCode === 13) { // enter key
          self.send('submit');
        }
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for dealing with API keys

  @class AdminApiController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminApiController = Ember.ArrayController.extend({

  actions: {
    /**
      Generates a master api key

      @method generateMasterKey
      @param {Discourse.ApiKey} the key to regenerate
    **/
    generateMasterKey: function(key) {
      var self = this;
      Discourse.ApiKey.generateMasterKey().then(function (key) {
        self.get('model').pushObject(key);
      });
    },

    /**
      Creates an API key instance with internal user object

      @method regenerateKey
      @param {Discourse.ApiKey} the key to regenerate
    **/
    regenerateKey: function(key) {
      bootbox.confirm(I18n.t("admin.api.confirm_regen"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          key.regenerate();
        }
      });
    },

    /**
      Revokes an API key

      @method revokeKey
      @param {Discourse.ApiKey} the key to revoke
    **/
    revokeKey: function(key) {
      var self = this;
      bootbox.confirm(I18n.t("admin.api.confirm_revoke"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          key.revoke().then(function() {
            self.get('model').removeObject(key);
          });
        }
      });
    }
  },

  /**
    Has a master key already been generated?

    @property hasMasterKey
    @type {Boolean}
  **/
  hasMasterKey: function() {
    return !!this.get('model').findBy('user', null);
  }.property('model.@each')

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A base admin controller that has access to the Discourse properties.

  @class AdminController
  @extends Discourse.Controller
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeController = Discourse.Controller.extend({});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports interface for creating custom CSS skins in Discourse.

  @class AdminCustomizeController
  @extends Ember.Controller
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeController = Ember.ArrayController.extend({

  actions: {

    /**
      Create a new customization style

      @method newCustomization
    **/
    newCustomization: function() {
      var item = Discourse.SiteCustomization.create({name: I18n.t("admin.customize.new_style")});
      this.pushObject(item);
      this.set('selectedItem', item);
    },

    /**
      Select a given style

      @method selectStyle
      @param {Discourse.SiteCustomization} style The style we are selecting
    **/
    selectStyle: function(style) {
      this.set('selectedItem', style);
    },

    /**
      Save the current customization

      @method save
    **/
    save: function() {
      this.get('selectedItem').save();
    },

    /**
      Destroy the current customization

      @method destroy
    **/
    destroy: function() {
      var _this = this;
      return bootbox.confirm(I18n.t("admin.customize.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        var selected;
        if (result) {
          selected = _this.get('selectedItem');
          selected.destroy();
          _this.set('selectedItem', null);
          return _this.removeObject(selected);
        }
      });
    }

  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the default interface when you enter the admin section.

  @class AdminDashboardController
  @extends Ember.Controller
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminDashboardController = Ember.Controller.extend({
  loading: true,
  versionCheck: null,
  problemsCheckMinutes: 1,

  foundProblems: function() {
    return(Discourse.User.currentProp('admin') && this.get('problems') && this.get('problems').length > 0);
  }.property('problems'),

  thereWereProblems: function() {
    if(!Discourse.User.currentProp('admin')) { return false }
    if( this.get('foundProblems') ) {
      this.set('hadProblems', true);
      return true;
    } else {
      return this.get('hadProblems') || false;
    }
  }.property('foundProblems'),

  loadProblems: function() {
    this.set('loadingProblems', true);
    this.set('problemsFetchedAt', new Date());
    var c = this;
    Discourse.AdminDashboard.fetchProblems().then(function(d) {
      c.set('problems', d.problems);
      c.set('loadingProblems', false);
      if( d.problems && d.problems.length > 0 ) {
        c.problemsCheckInterval = 1;
      } else {
        c.problemsCheckInterval = 10;
      }
    });
  },

  problemsTimestamp: function() {
    return moment(this.get('problemsFetchedAt')).format('LLL');
  }.property('problemsFetchedAt'),

  updatedTimestamp: function() {
    return moment(this.get('updated_at')).format('LLL');
  }.property('updated_at'),

  actions: {
    refreshProblems: function() {
      this.loadProblems();
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports email functionality.

  @class AdminEmailIndexController
  @extends Discourse.Controller
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailIndexController = Discourse.Controller.extend({

  /**
    Is the "send test email" button disabled?

    @property sendTestEmailDisabled
  **/
  sendTestEmailDisabled: Em.computed.empty('testEmailAddress'),

  /**
    Clears the 'sentTestEmail' property on successful send.

    @method testEmailAddressChanged
  **/
  testEmailAddressChanged: function() {
    this.set('sentTestEmail', false);
  }.observes('testEmailAddress'),

  actions: {
    /**
      Sends a test email to the currently entered email address

      @method sendTestEmail
    **/
    sendTestEmail: function() {
      this.set('sentTestEmail', false);

      var adminEmailLogsController = this;
      Discourse.ajax("/admin/email/test", {
        type: 'POST',
        data: { email_address: this.get('testEmailAddress') }
      }).then(function () {
        adminEmailLogsController.set('sentTestEmail', true);
      });

    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller previews an email digest

  @class AdminEmailPreviewDigestController
  @extends Discourse.ObjectController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailPreviewDigestController = Discourse.ObjectController.extend({

  actions: {
    refresh: function() {
      var model = this.get('model'),
          self = this;

      self.set('loading', true);
      Discourse.EmailPreview.findDigest(this.get('lastSeen')).then(function (email) {
        model.setProperties(email.getProperties('html_content', 'text_content'));
        self.set('loading', false);
      });
    },

    toggleShowHtml: function() {
      this.toggleProperty('showHtml');
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for dealing with flags in the admin section.

  @class AdminFlagsController
  @extends Ember.Controller
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminFlagsController = Ember.ArrayController.extend({

  actions: {
    /**
      Clear all flags on a post

      @method clearFlags
      @param {Discourse.FlaggedPost} item The post whose flags we want to clear
    **/
    disagreeFlags: function(item) {
      var adminFlagsController = this;
      item.disagreeFlags().then((function() {
        adminFlagsController.removeObject(item);
      }), function() {
        bootbox.alert(I18n.t("admin.flags.error"));
      });
    },

    agreeFlags: function(item) {
      var adminFlagsController = this;
      item.agreeFlags().then((function() {
        adminFlagsController.removeObject(item);
      }), function() {
        bootbox.alert(I18n.t("admin.flags.error"));
      });
    },

    deferFlags: function(item) {
      var adminFlagsController = this;
      item.deferFlags().then((function() {
        adminFlagsController.removeObject(item);
      }), function() {
        bootbox.alert(I18n.t("admin.flags.error"));
      });
    },

    /**
      Deletes a post

      @method deletePost
      @param {Discourse.FlaggedPost} post The post to delete
    **/
    deletePost: function(post) {
      var adminFlagsController = this;
      post.deletePost().then((function() {
        adminFlagsController.removeObject(post);
      }), function() {
        bootbox.alert(I18n.t("admin.flags.error"));
      });
    },

    /**
      Deletes a user and all posts and topics created by that user.

      @method deleteSpammer
      @param {Discourse.FlaggedPost} item The post to delete
    **/
    deleteSpammer: function(item) {
      item.get('user').deleteAsSpammer(function() { window.location.reload(); });
    }
  },

  /**
    Are we viewing the 'old' view?

    @property adminOldFlagsView
  **/
  adminOldFlagsView: Em.computed.equal('query', 'old'),

  /**
    Are we viewing the 'active' view?

    @property adminActiveFlagsView
  **/
  adminActiveFlagsView: Em.computed.equal('query', 'active'),

  loadMore: function(){
    var flags = this.get('model');
    return Discourse.FlaggedPost.findAll(this.get('query'),flags.length+1).then(function(data){
      if(data.length===0){
        flags.set('allLoaded',true);
      }
      flags.addObjects(data);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller is for the widget that shows the commits to the discourse repo.

  @class AdminGithubCommitsController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminGithubCommitsController = Ember.ArrayController.extend({
  goToGithub: function() {
    window.open('https://github.com/discourse/discourse');
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminGroupsController = Ember.Controller.extend({
  itemController: 'adminGroup',

  actions: {
    edit: function(group){
      this.get('model').select(group);
      group.load();
    },

    refreshAutoGroups: function(){
      var self = this;

      self.set('refreshingAutoGroups', true);
      Discourse.ajax('/admin/groups/refresh_automatic_groups', {type: 'POST'}).then(function() {
        self.set('model', Discourse.Group.findAll());
        self.set('refreshingAutoGroups', false);
      });
    },

    newGroup: function(){
      var group = Discourse.Group.create();
      group.set("loaded", true);
      var model = this.get("model");
      model.addObject(group);
      model.select(group);
    },

    save: function(group){
      if(!group.get("id")){
        group.create();
      } else {
        group.save();
      }
    },

    destroy: function(group){
      var self = this;
      return bootbox.confirm(I18n.t("admin.groups.delete_confirm"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          group.destroy().then(function(deleted) {
            if (deleted) {
              self.get("model").removeObject(group);
            }
          });
        }
      });
    }
  }

});



// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for listing screened email addresses in the admin section.

  @class AdminLogsScreenedEmailsController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsScreenedEmailsController = Ember.ArrayController.extend(Discourse.Presence, {
  loading: false,
  content: [],

  show: function() {
    var self = this;
    this.set('loading', true);
    Discourse.ScreenedEmail.findAll().then(function(result) {
      self.set('content', result);
      self.set('loading', false);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for listing screened IP addresses in the admin section.

  @class AdminLogsScreenedIpAddressesController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsScreenedIpAddressesController = Ember.ArrayController.extend(Discourse.Presence, {
  loading: false,
  content: [],
  itemController: 'adminLogsScreenedIpAddress',

  show: function() {
    var self = this;
    this.set('loading', true);
    Discourse.ScreenedIpAddress.findAll().then(function(result) {
      self.set('content', result);
      self.set('loading', false);
    });
  },

  actions: {
    recordAdded: function(arg) {
      this.get("content").unshiftObject(arg);
    }
  }
});

Discourse.AdminLogsScreenedIpAddressController = Ember.ObjectController.extend({
  editing: false,
  savedIpAddress: null,

  actions: {
    allow: function(record) {
      record.set('action_name', 'do_nothing');
      this.send('save', record);
    },

    block: function(record) {
      record.set('action_name', 'block');
      this.send('save', record);
    },

    edit: function() {
      if (!this.get('editing')) {
        this.savedIpAddress = this.get('ip_address');
      }
      this.set('editing', true);
    },

    cancel: function() {
      if (this.get('savedIpAddress') && this.get('editing')) {
        this.set('ip_address', this.get('savedIpAddress'));
      }
      this.set('editing', false);
    },

    save: function(record) {
      var self = this;
      var wasEditing = this.get('editing');
      this.set('editing', false);
      record.save().then(function(saved){
        if (saved.success) {
          self.set('savedIpAddress', null);
        } else {
          bootbox.alert(saved.errors);
          if (wasEditing) self.set('editing', true);
        }
      }, function(e){
        if (e.responseJSON && e.responseJSON.errors) {
          bootbox.alert(I18n.t("generic_error_with_reason", {error: e.responseJSON.errors.join('. ')}));
        } else {
          bootbox.alert(I18n.t("generic_error"));
        }
        if (wasEditing) self.set('editing', true);
      });
    },

    destroy: function(record) {
      var self = this;
      return bootbox.confirm(I18n.t("admin.logs.screened_ips.delete_confirm", {ip_address: record.get('ip_address')}), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          record.destroy().then(function(deleted) {
            if (deleted) {
              self.get("parentController.content").removeObject(record);
            } else {
              bootbox.alert(I18n.t("generic_error"));
            }
          }, function(e){
            bootbox.alert(I18n.t("generic_error_with_reason", {error: "http: " + e.status + " - " + e.body}));
          });
        }
      });
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for listing screened URLs in the admin section.

  @class AdminLogsScreenedUrlsController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsScreenedUrlsController = Ember.ArrayController.extend(Discourse.Presence, {
  loading: false,
  content: [],

  show: function() {
    var self = this;
    this.set('loading', true);
    Discourse.ScreenedUrl.findAll().then(function(result) {
      self.set('content', result);
      self.set('loading', false);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for listing staff action logs in the admin section.

  @class AdminLogsStaffActionLogsController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsStaffActionLogsController = Ember.ArrayController.extend(Discourse.Presence, {
  loading: false,
  filters: {},

  show: function() {
    var self = this;
    this.set('loading', true);
    Discourse.URL.set('queryParams', this.get('filters')); // TODO: doesn't work
    Discourse.StaffActionLog.findAll(this.get('filters')).then(function(result) {
      self.set('content', result);
      self.set('loading', false);
    });
  }.observes('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),

  filtersExists: function() {
    return (_.size(this.get('filters')) > 0);
  }.property('filters.action_name', 'filters.acting_user', 'filters.target_user', 'filters.subject'),

  actionFilter: function() {
    if (this.get('filters.action_name')) {
      return I18n.t("admin.logs.staff_actions.actions." + this.get('filters.action_name'));
    } else {
      return null;
    }
  }.property('filters.action_name'),

  showInstructions: function() {
    return this.get('model.length') > 0;
  }.property('loading', 'model.length'),

  actions: {
    clearFilter: function(key) {
      delete this.get('filters')[key];
      this.notifyPropertyChange('filters');
    },

    clearAllFilters: function() {
      this.set('filters', {});
    },

    filterByAction: function(action) {
      this.set('filters.action_name', action);
    },

    filterByStaffUser: function(acting_user) {
      this.set('filters.acting_user', acting_user.username);
    },

    filterByTargetUser: function(target_user) {
      this.set('filters.target_user', target_user.username);
    },

    filterBySubject: function(subject) {
      this.set('filters.subject', subject);
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminReportsController = Ember.ObjectController.extend({
  viewMode: 'table',

  viewingTable: Em.computed.equal('viewMode', 'table'),
  viewingBarChart: Em.computed.equal('viewMode', 'barChart'),

  actions: {
    // Changes the current view mode to 'table'
    viewAsTable: function() {
      this.set('viewMode', 'table');
    },

    // Changes the current view mode to 'barChart'
    viewAsBarChart: function() {
      this.set('viewMode', 'barChart');
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller is used for editing site content

  @class AdminSiteContentEditController
  @extends Ember.ObjectController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteContentEditController = Discourse.Controller.extend({

  saveDisabled: function() {
    if (this.get('saving')) { return true; }
    if ((!this.get('content.allow_blank')) && this.blank('content.content')) { return true; }
    return false;
  }.property('saving', 'content.content'),

  actions: {
    saveChanges: function() {
      var self = this;
      self.setProperties({saving: true, saved: false});
      self.get('content').save().then(function () {
        self.setProperties({saving: false, saved: true});
      });
    }
  }
});

Discourse.AdminSiteContentsController = Ember.ArrayController.extend({});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminSiteSettingsCategoryController = Ember.ObjectController.extend({
  categoryNameKey: null,
  needs: ['adminSiteSettings'],

  filteredContent: function() {
    if (!this.get('categoryNameKey')) { return Em.A(); }

    var category = this.get('controllers.adminSiteSettings.content').find(function(siteSettingCategory) {
      return siteSettingCategory.nameKey === this.get('categoryNameKey');
    }, this);

    if (category) {
      return category.siteSettings;
    } else {
      return Em.A();
    }
  }.property('controllers.adminSiteSettings.content', 'categoryNameKey'),

  emptyContentHandler: function() {
    if (this.get('filteredContent').length < 1) {
      if ( this.get('controllers.adminSiteSettings.filtered') ) {
        this.transitionToRoute('adminSiteSettingsCategory', 'all_results');
      } else {
        this.transitionToRoute('adminSiteSettings');
      }
    }
  }.observes('filteredContent'),

  actions: {

    /**
      Reset a setting to its default value

      @method resetDefault
      @param {Discourse.SiteSetting} setting The setting we want to revert
    **/
    resetDefault: function(setting) {
      setting.set('value', setting.get('default'));
      setting.save();
    },

    /**
      Save changes to a site setting

      @method save
      @param {Discourse.SiteSetting} setting The setting we've changed
    **/
    save: function(setting) {
      setting.save();
    },

    /**
      Cancel changes to a site setting

      @method cancel
      @param {Discourse.SiteSetting} setting The setting we've changed but want to revert
    **/
    cancel: function(setting) {
      setting.resetValue();
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for SiteSettings.

  @class AdminSiteSettingsController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteSettingsController = Ember.ArrayController.extend(Discourse.Presence, {
  filter: null,
  onlyOverridden: false,
  filtered: Ember.computed.notEmpty('filter'),

  /**
    The list of settings based on the current filters

    @property filterContent
  **/
  filterContent: Discourse.debounce(function() {

    // If we have no content, don't bother filtering anything
    if (!this.present('allSiteSettings')) return;

    var filter;
    if (this.get('filter')) {
      filter = this.get('filter').toLowerCase();
    }

    if ((filter === undefined || filter.length < 1) && !this.get('onlyOverridden')) {
      this.set('model', this.get('allSiteSettings'));
      return;
    }

    var self = this,
        matches,
        matchesGroupedByCategory = Em.A([{nameKey: 'all_results', name: I18n.t('admin.site_settings.categories.all_results'), siteSettings: []}]);

    _.each(this.get('allSiteSettings'), function(settingsCategory) {
      matches = settingsCategory.siteSettings.filter(function(item) {
        if (self.get('onlyOverridden') && !item.get('overridden')) return false;
        if (filter) {
          if (item.get('setting').toLowerCase().indexOf(filter) > -1) return true;
          if (item.get('description').toLowerCase().indexOf(filter) > -1) return true;
          if (item.get('value').toLowerCase().indexOf(filter) > -1) return true;
          return false;
        } else {
          return true;
        }
      });
      if (matches.length > 0) {
        matchesGroupedByCategory[0].siteSettings.pushObjects(matches);
        matchesGroupedByCategory.pushObject({
          nameKey: settingsCategory.nameKey,
          name: settingsCategory.name,
          siteSettings: matches});
      }
    });

    this.set('model', matchesGroupedByCategory);
  }, 250).observes('filter', 'onlyOverridden')

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The modal for viewing the details of a staff action log record.

  @class AdminStaffActionLogDetailsController
  @extends Discourse.Controller
  @namespace Discourse
  @uses Discourse.ModalFunctionality
  @module Discourse
**/

Discourse.AdminStaffActionLogDetailsController = Discourse.ObjectController.extend(Discourse.ModalFunctionality, {});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The modal for suspending a user.

  @class AdminSuspendUserController
  @extends Discourse.Controller
  @namespace Discourse
  @uses Discourse.ModalFunctionality
  @module Discourse
**/

Discourse.AdminSuspendUserController = Discourse.ObjectController.extend(Discourse.ModalFunctionality, {

  actions: {
    suspend: function() {
      var duration = parseInt(this.get('duration'), 10);
      if (duration > 0) {
        var self = this;
        this.send('hideModal');
        this.get('model').suspend(duration, this.get('reason')).then(function() {
          window.location.reload();
        }, function(e) {
          var error = I18n.t('admin.user.suspend_failed', { error: "http: " + e.status + " - " + e.body });
          bootbox.alert(error, function() { self.send('showModal'); });
        });
      }
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A controller related to viewing a user in the admin section

  @class AdminUserController
  @extends Discourse.ObjectController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUserController = Discourse.ObjectController.extend({
  editingTitle: false,

  showApproval: function() {
    return Discourse.SiteSettings.must_approve_users;
  }.property(),

  actions: {
    toggleTitleEdit: function() {
      this.toggleProperty('editingTitle');
    },

    saveTitle: function() {
      Discourse.ajax("/users/" + this.get('username').toLowerCase(), {
        data: {title: this.get('title')},
        type: 'PUT'
      }).then(null, function(e){
        bootbox.alert(I18n.t("generic_error_with_reason", {error: "http: " + e.status + " - " + e.body}));
      });

      this.send('toggleTitleEdit');
    },

    generateApiKey: function() {
      this.get('model').generateApiKey();
    },

    regenerateApiKey: function() {
      var self = this;
      bootbox.confirm(I18n.t("admin.api.confirm_regen"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          self.get('model').generateApiKey();
        }
      });
    },

    revokeApiKey: function() {
      var self = this;
      bootbox.confirm(I18n.t("admin.api.confirm_revoke"), I18n.t("no_value"), I18n.t("yes_value"), function(result) {
        if (result) {
          self.get('model').revokeApiKey();
        }
      });
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  This controller supports the interface for listing users in the admin section.

  @class AdminUsersListController
  @extends Ember.ArrayController
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUsersListController = Ember.ArrayController.extend(Discourse.Presence, {
  username: null,
  query: null,
  selectAll: false,
  content: null,
  loading: false,

  queryNew: Em.computed.equal('query', 'new'),
  queryPending: Em.computed.equal('query', 'pending'),
  queryHasApproval: Em.computed.or('queryNew', 'queryPending'),

  /**
    Triggered when the selectAll property is changed

    @event selectAll
  **/
  selectAllChanged: function() {
    var _this = this;
    _.each(this.get('content'),function(user) {
      user.set('selected', _this.get('selectAll'));
    });
  }.observes('selectAll'),

  /**
    Triggered when the username filter is changed

    @event filterUsers
  **/
  filterUsers: Discourse.debounce(function() {
    this.refreshUsers();
  }, 250).observes('username'),

  /**
    Triggered when the order of the users list is changed

    @event orderChanged
  **/
  orderChanged: function() {
    this.refreshUsers();
  }.observes('query'),

  /**
    The title of the user list, based on which query was performed.

    @property title
  **/
  title: function() {
    return I18n.t('admin.users.titles.' + this.get('query'));
  }.property('query'),

  /**
    Do we want to show the approval controls?

    @property showApproval
  **/
  showApproval: function() {
    return Discourse.SiteSettings.must_approve_users && this.get('queryHasApproval');
  }.property('queryPending'),

  /**
    How many users are currently selected

    @property selectedCount
  **/
  selectedCount: function() {
    if (this.blank('content')) return 0;
    return this.get('content').filterProperty('selected').length;
  }.property('content.@each.selected'),

  /**
    Do we have any selected users?

    @property hasSelection
  **/
  hasSelection: Em.computed.gt('selectedCount', 0),

  /**
    Refresh the current list of users.

    @method refreshUsers
  **/
  refreshUsers: function() {
    var adminUsersListController = this;
    adminUsersListController.set('loading', true);

    Discourse.AdminUser.findAll(this.get('query'), this.get('username')).then(function (result) {
      adminUsersListController.set('content', result);
      adminUsersListController.set('loading', false);
    });
  },


  /**
    Show the list of users.

    @method show
  **/
  show: function(term) {
    if (this.get('query') === term) {
      this.refreshUsers();
      return;
    }
    this.set('query', term);
  },

  /**
    Approve all the currently selected users.

    @method approveUsers
  **/
  approveUsers: function() {
    Discourse.AdminUser.bulkApprove(this.get('content').filterProperty('selected'));
    this.refreshUsers();
  },

  /**
    Reject all the currently selected users.

    @method rejectUsers
  **/
  rejectUsers: function() {
    var controller = this;
    Discourse.AdminUser.bulkReject(this.get('content').filterProperty('selected')).then(function(result){
      var message = I18n.t("admin.users.reject_successful", {count: result.success});
      if (result.failed > 0) {
        message += ' ' + I18n.t("admin.users.reject_failures", {count: result.failed});
        message += ' ' + I18n.t("admin.user.delete_forbidden", {count: Discourse.SiteSettings.delete_user_max_age});
      }
      bootbox.alert(message);
      controller.refreshUsers();
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The modal for viewing the details of a staff action log record
  for when a site customization is created or changed.

  @class ChangeSiteCustomizationDetailsController
  @extends Discourse.Controller
  @namespace Discourse
  @uses Discourse.ModalFunctionality
  @module Discourse
**/

Discourse.ChangeSiteCustomizationDetailsController = Discourse.ObjectController.extend(Discourse.ModalFunctionality, {
  previousSelected: Ember.computed.equal('selectedTab', 'previous'),
  newSelected:      Ember.computed.equal('selectedTab', 'new'),

  onShow: function() {
    this.selectNew();
  },

  selectNew: function() {
    this.set('selectedTab', 'new');
  },

  selectPrevious: function() {
    this.set('selectedTab', 'previous');
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The modal for viewing the details of a staff action log record
  for when a site customization is deleted.

  @class DeleteSiteCustomizationDetailsController
  @extends Discourse.Controller
  @namespace Discourse
  @uses Discourse.ModalFunctionality
  @module Discourse
**/

Discourse.DeleteSiteCustomizationDetailsController = Discourse.ChangeSiteCustomizationDetailsController.extend({
  onShow: function() {
    this.selectPrevious();
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Return the count of users at the given trust level.

  @method valueAtTrustLevel
  @for Handlebars
**/

Handlebars.registerHelper('valueAtTrustLevel', function(property, trustLevel) {
  var data = Ember.Handlebars.get(this, property);
  if( data ) {
    var item = data.find( function(d, i, arr) { return parseInt(d.x,10) === parseInt(trustLevel,10); } );
    if( item ) {
      return item.y;
    } else {
      return 0;
    }
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A model that stores all or some data that is displayed on the dashboard.

  @class AdminDashboard
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/


Discourse.AdminDashboard = Discourse.Model.extend({});

Discourse.AdminDashboard.reopenClass({

  /**
    Fetch all dashboard data. This can be an expensive request when the cached data
    has expired and the server must collect the data again.

    @method find
    @return {jqXHR} a jQuery Promise object
  **/
  find: function() {
    return Discourse.ajax("/admin/dashboard").then(function(json) {
      var model = Discourse.AdminDashboard.create(json);
      model.set('loaded', true);
      return model;
    });
  },

  /**
    Only fetch the list of problems that should be rendered on the dashboard.
    The model will only have its "problems" attribute set.

    @method fetchProblems
    @return {jqXHR} a jQuery Promise object
  **/
  fetchProblems: function() {
    return Discourse.ajax("/admin/dashboard/problems", {
      type: 'GET',
      dataType: 'json'
    }).then(function(json) {
      var model = Discourse.AdminDashboard.create(json);
      model.set('loaded', true);
      return model;
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for dealing with users from the admin section.

  @class AdminUser
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUser = Discourse.User.extend({

  /**
    Generates an API key for the user. Will regenerate if they already have one.

    @method generateApiKey
    @returns {Promise} a promise that resolves to the newly generated API key
  **/
  generateApiKey: function() {
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/generate_api_key", {type: 'POST'}).then(function (result) {
      var apiKey = Discourse.ApiKey.create(result.api_key);
      self.set('api_key', apiKey);
      return apiKey;
    });
  },

  /**
    Revokes a user's current API key

    @method revokeApiKey
    @returns {Promise} a promise that resolves when the API key has been deleted
  **/
  revokeApiKey: function() {
    var self = this;
    return Discourse.ajax("/admin/users/" + this.get('id') + "/revoke_api_key", {type: 'DELETE'}).then(function (result) {
      self.set('api_key', null);
    });
  },

  deleteAllPosts: function() {
    this.set('can_delete_all_posts', false);
    var user = this;
    var message = I18n.t('admin.user.delete_all_posts_confirm', {posts: user.get('post_count'), topics: user.get('topic_count')});
    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel",
      "link":  true,
      "callback": function() {
        user.set('can_delete_all_posts', true);
      }
    }, {
      "label": '<i class="icon icon-warning-sign"></i> ' + I18n.t("admin.user.delete_all_posts"),
      "class": "btn btn-danger",
      "callback": function() {
        Discourse.ajax("/admin/users/" + (user.get('id')) + "/delete_all_posts", {type: 'PUT'}).then(function(result){
          user.set('post_count', 0);
        });
      }
    }];
    bootbox.dialog(message, buttons, {"classes": "delete-all-posts"});
  },

  // Revoke the user's admin access
  revokeAdmin: function() {
    this.set('admin', false);
    this.set('can_grant_admin', true);
    this.set('can_revoke_admin', false);
    return Discourse.ajax("/admin/users/" + (this.get('id')) + "/revoke_admin", {type: 'PUT'});
  },

  grantAdmin: function() {
    this.set('admin', true);
    this.set('can_grant_admin', false);
    this.set('can_revoke_admin', true);
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/grant_admin", {type: 'PUT'});
  },

  // Revoke the user's moderation access
  revokeModeration: function() {
    this.set('moderator', false);
    this.set('can_grant_moderation', true);
    this.set('can_revoke_moderation', false);
    return Discourse.ajax("/admin/users/" + (this.get('id')) + "/revoke_moderation", {type: 'PUT'});
  },

  grantModeration: function() {
    this.set('moderator', true);
    this.set('can_grant_moderation', false);
    this.set('can_revoke_moderation', true);
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/grant_moderation", {type: 'PUT'});
  },

  refreshBrowsers: function() {
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/refresh_browsers", {type: 'POST'});
    bootbox.alert("Message sent to all clients!");
  },

  approve: function() {
    this.set('can_approve', false);
    this.set('approved', true);
    this.set('approved_by', Discourse.User.current());
    Discourse.ajax("/admin/users/" + (this.get('id')) + "/approve", {type: 'PUT'});
  },

  username_lower: (function() {
    return this.get('username').toLowerCase();
  }).property('username'),

  setOriginalTrustLevel: function() {
    this.set('originalTrustLevel', this.get('trust_level'));
  },

  trustLevels: function() {
    return Discourse.Site.currentProp('trustLevels');
  }.property(),

  dirty: Discourse.computed.propertyNotEqual('originalTrustLevel', 'trustLevel.id'),

  saveTrustLevel: function() {
    Discourse.ajax("/admin/users/" + this.id + "/trust_level", {
      type: 'PUT',
      data: {level: this.get('trustLevel.id')}
    }).then(function () {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failure
      var error = I18n.t('admin.user.trust_level_change_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  restoreTrustLevel: function() {
    this.set('trustLevel.id', this.get('originalTrustLevel'));
  },

  isSuspended: Em.computed.equal('suspended', true),
  canSuspend: Em.computed.not('staff'),

  suspendDuration: function() {
    var suspended_at = moment(this.suspended_at);
    var suspended_till = moment(this.suspended_till);
    return suspended_at.format('L') + " - " + suspended_till.format('L');
  }.property('suspended_till', 'suspended_at'),

  suspend: function(duration, reason) {
    return Discourse.ajax("/admin/users/" + this.id + "/suspend", {
      type: 'PUT',
      data: {duration: duration, reason: reason}
    });
  },

  unsuspend: function() {
    Discourse.ajax("/admin/users/" + this.id + "/unsuspend", {
      type: 'PUT'
    }).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.unsuspend_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  impersonate: function() {
    Discourse.ajax("/admin/impersonate", {
      type: 'POST',
      data: { username_or_email: this.get('username') }
    }).then(function() {
      // succeeded
      document.location = "/";
    }, function(e) {
      // failed
      if (e.status === 404) {
        bootbox.alert(I18n.t('admin.impersonate.not_found'));
      } else {
        bootbox.alert(I18n.t('admin.impersonate.invalid'));
      }
    });
  },

  activate: function() {
    Discourse.ajax('/admin/users/' + this.id + '/activate', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.activate_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  deactivate: function() {
    Discourse.ajax('/admin/users/' + this.id + '/deactivate', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.deactivate_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  unblock: function() {
    Discourse.ajax('/admin/users/' + this.id + '/unblock', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.unblock_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  block: function() {
    Discourse.ajax('/admin/users/' + this.id + '/block', {type: 'PUT'}).then(function() {
      // succeeded
      window.location.reload();
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.block_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  sendActivationEmail: function() {
    Discourse.ajax('/users/' + this.get('username') + '/send_activation_email', {type: 'POST'}).then(function() {
      // succeeded
      bootbox.alert( I18n.t('admin.user.activation_email_sent') );
    }, function(e) {
      // failed
      var error = I18n.t('admin.user.send_activation_email_failed', { error: "http: " + e.status + " - " + e.body });
      bootbox.alert(error);
    });
  },

  deleteForbidden: function() {
    return (!this.get('can_be_deleted') || this.get('post_count') > 0);
  }.property('post_count'),

  deleteButtonTitle: function() {
    if (this.get('deleteForbidden')) {
      return I18n.t('admin.user.delete_forbidden', {count: Discourse.SiteSettings.delete_user_max_age});
    } else {
      return null;
    }
  }.property('deleteForbidden'),

  destroy: function() {
    var user = this;

    var performDestroy = function(block) {
      var formData = { context: window.location.pathname };
      if (block) {
        formData["block_email"] = true;
        formData["block_urls"] = true;
        formData["block_ip"] = true;
      }
      Discourse.ajax("/admin/users/" + user.get('id') + '.json', {
        type: 'DELETE',
        data: formData
      }).then(function(data) {
        if (data.deleted) {
          bootbox.alert(I18n.t("admin.user.deleted"), function() {
            document.location = "/admin/users/list/active";
          });
        } else {
          bootbox.alert(I18n.t("admin.user.delete_failed"));
          if (data.user) {
            user.mergeAttributes(data.user);
          }
        }
      }, function(jqXHR, status, error) {
        Discourse.AdminUser.find( user.get('username') ).then(function(u){ user.mergeAttributes(u); });
        bootbox.alert(I18n.t("admin.user.delete_failed"));
      });
    };

    var message = I18n.t("admin.user.delete_confirm");

    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel",
      "link":  true
    }, {
      "label": '<i class="icon icon-warning-sign"></i> ' + I18n.t('admin.user.delete_dont_block'),
      "class": "btn",
      "callback": function(){
        performDestroy(false);
      }
    }, {
      "label": '<i class="icon icon-warning-sign"></i> ' + I18n.t('admin.user.delete_and_block'),
      "class": "btn",
      "callback": function(){
        performDestroy(true);
      }
    }];

    bootbox.dialog(message, buttons, {"classes": "delete-user-modal"});
  },

  deleteAsSpammer: function(successCallback) {
    var user = this;
    var message = I18n.t('flagging.delete_confirm', {posts: user.get('post_count'), topics: user.get('topic_count'), email: user.get('email'), ip_address: user.get('ip_address')});
    var buttons = [{
      "label": I18n.t("composer.cancel"),
      "class": "cancel",
      "link":  true
    }, {
      "label": '<i class="icon icon-warning-sign"></i> ' + I18n.t("flagging.yes_delete_spammer"),
      "class": "btn btn-danger",
      "callback": function() {
        Discourse.ajax("/admin/users/" + user.get('id') + '.json', {
          type: 'DELETE',
          data: {delete_posts: true, block_email: true, block_urls: true, block_ip: true, context: window.location.pathname}
        }).then(function(data) {
          if (data.deleted) {
            bootbox.alert(I18n.t("admin.user.deleted"), function() {
              if (successCallback) successCallback();
            });
          } else {
            bootbox.alert(I18n.t("admin.user.delete_failed"));
          }
        }, function(jqXHR, status, error) {
          bootbox.alert(I18n.t("admin.user.delete_failed"));
        });
      }
    }];
    bootbox.dialog(message, buttons, {"classes": "flagging-delete-spammer"});
  },

  loadDetails: function() {
    var model = this;
    if (model.get('loadedDetails')) { return Ember.RSVP.resolve(model); }

    return Discourse.AdminUser.find(model.get('username_lower')).then(function (result) {
      model.setProperties(result);
      model.set('loadedDetails', true);
    });
  }

});

Discourse.AdminUser.reopenClass({

  bulkApprove: function(users) {
    _.each(users, function(user) {
      user.set('approved', true);
      user.set('can_approve', false);
      return user.set('selected', false);
    });

    bootbox.alert(I18n.t("admin.user.approve_bulk_success"));

    return Discourse.ajax("/admin/users/approve-bulk", {
      type: 'PUT',
      data: {
        users: users.map(function(u) {
          return u.id;
        })
      }
    });
  },

  bulkReject: function(users) {
    _.each(users, function(user){
      user.set('can_approve', false);
      user.set('selected', false);
    });

    return Discourse.ajax("/admin/users/reject-bulk", {
      type: 'DELETE',
      data: {
        users: users.map(function(u) { return u.id; }),
        context: window.location.pathname
      }
    });
  },

  find: function(username) {
    return Discourse.ajax("/admin/users/" + username).then(function (result) {
      result.loadedDetails = true;
      return Discourse.AdminUser.create(result);
    });
  },

  findAll: function(query, filter) {
    return Discourse.ajax("/admin/users/list/" + query + ".json", {
      data: { filter: filter }
    }).then(function(users) {
      return users.map(function(u) {
        return Discourse.AdminUser.create(u);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing an API key in the system

  @class ApiKey
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ApiKey = Discourse.Model.extend({

  /**
    Regenerates the api key

    @method regenerate
    @returns {Promise} a promise that resolves to the key
  **/
  regenerate: function() {
    var self = this;
    return Discourse.ajax('/admin/api/key', {type: 'PUT', data: {id: this.get('id')}}).then(function (result) {
      self.set('key', result.api_key.key);
      return self;
    });
  },

  /**
    Revokes the current key

    @method revoke
    @returns {Promise} a promise that resolves when the key has been revoked
  **/
  revoke: function() {
    var self = this;
    return Discourse.ajax('/admin/api/key', {type: 'DELETE', data: {id: this.get('id')}});
  }

});

Discourse.ApiKey.reopenClass({

  /**
    Creates an API key instance with internal user object

    @method create
    @param {Object} the properties to create
    @returns {Discourse.ApiKey} the ApiKey instance
  **/
  create: function() {
    var result = this._super.apply(this, arguments);
    if (result.user) {
      result.user = Discourse.AdminUser.create(result.user);
    }
    return result;
  },

  /**
    Finds a list of API keys

    @method find
    @returns {Promise} a promise that resolves to the array of `Discourse.ApiKey` instances
  **/
  find: function() {
    return Discourse.ajax("/admin/api").then(function(keys) {
      return keys.map(function (key) {
        return Discourse.ApiKey.create(key);
      });
    });
  },

  /**
    Generates a master api key and returns it.

    @method generateMasterKey
    @returns {Promise} a promise that resolves to a master `Discourse.ApiKey`
  **/
  generateMasterKey: function() {
    return Discourse.ajax("/admin/api/key", {type: 'POST'}).then(function (result) {
      return Discourse.ApiKey.create(result.api_key);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing an email log.

  @class EmailLog
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailLog = Discourse.Model.extend({});

Discourse.EmailLog.reopenClass({
  create: function(attrs) {
    attrs = attrs || {};

    if (attrs.user) {
      attrs.user = Discourse.AdminUser.create(attrs.user);
    }
    return this._super(attrs);
  },

  findAll: function(filter) {
    var result = Em.A();
    Discourse.ajax("/admin/email/logs.json", {
      data: { filter: filter }
    }).then(function(logs) {
      _.each(logs,function(log) {
        result.pushObject(Discourse.EmailLog.create(log));
      });
    });
    return result;
  }
});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for showing a preview of an email

  @class EmailPreview
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailPreview = Discourse.Model.extend({});

Discourse.EmailPreview.reopenClass({
  findDigest: function(last_seen_at) {
    return $.ajax("/admin/email/preview-digest.json", {
      data: {last_seen_at: last_seen_at}
    }).then(function (result) {
      return Discourse.EmailPreview.create(result);
    });
  }
});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for representing the current email settings

  @class EmailSettings
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.EmailSettings = Discourse.Model.extend({});

Discourse.EmailSettings.reopenClass({
  find: function() {
    return Discourse.ajax("/admin/email.json").then(function (settings) {
      return Discourse.EmailSettings.create(settings);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with flagged posts.

  @class FlaggedPost
  @extends Discourse.Post
  @namespace Discourse
  @module Discourse
**/

Discourse.FlaggedPost = Discourse.Post.extend({

  summary: function(){
    return _(this.post_actions)
      .groupBy(function(a){ return a.post_action_type_id; })
      .map(function(v,k){
        return I18n.t('admin.flags.summary.action_type_' + k, {count: v.length});
      })
      .join(',');
  }.property(),

  flaggers: function() {
    var r,
      _this = this;
    r = [];
    _.each(this.post_actions, function(action) {
      var user = _this.userLookup[action.user_id];
      var flagType = I18n.t('admin.flags.summary.action_type_' + action.post_action_type_id, {count: 1});
      r.push({user: user, flagType: flagType, flaggedAt: action.created_at});
    });
    return r;
  }.property(),

  messages: function() {
    var r,
      _this = this;
    r = [];
    _.each(this.post_actions,function(action) {
      if (action.message) {
        r.push({
          user: _this.userLookup[action.user_id],
          message: action.message,
          permalink: action.permalink,
          bySystemUser: (action.user_id === -1 ? true : false)
        });
      }
    });
    return r;
  }.property(),

  lastFlagged: function() {
    return this.post_actions[0].created_at;
  }.property(),

  user: function() {
    return this.userLookup[this.user_id];
  }.property(),

  topicHidden: function() {
    return !this.get('topic_visible');
  }.property('topic_hidden'),

  flaggedForSpam: function() {
    return !_.every(this.get('post_actions'), function(action) { return action.name_key !== 'spam'; });
  }.property('post_actions.@each.name_key'),

  canDeleteAsSpammer: function() {
    return (Discourse.User.currentProp('staff') && this.get('flaggedForSpam') && this.get('user.can_delete_all_posts') && this.get('user.can_be_deleted'));
  }.property('flaggedForSpam'),

  deletePost: function() {
    if (this.get('post_number') === 1) {
      return Discourse.ajax('/t/' + this.topic_id, { type: 'DELETE', cache: false });
    } else {
      return Discourse.ajax('/posts/' + this.id, { type: 'DELETE', cache: false });
    }
  },

  disagreeFlags: function() {
    return Discourse.ajax('/admin/flags/disagree/' + this.id, { type: 'POST', cache: false });
  },

  deferFlags: function() {
    return Discourse.ajax('/admin/flags/defer/' + this.id, { type: 'POST', cache: false });
  },

  agreeFlags: function() {
    return Discourse.ajax('/admin/flags/agree/' + this.id, { type: 'POST', cache: false });
  },

  postHidden: Em.computed.alias('hidden'),

  extraClasses: function() {
    var classes = [];
    if (this.get('hidden')) {
      classes.push('hidden-post');
    }
    if (this.get('deleted')){
      classes.push('deleted');
    }
    return classes.join(' ');
  }.property(),

  deleted: Em.computed.or('deleted_at', 'topic_deleted_at')

});

Discourse.FlaggedPost.reopenClass({
  findAll: function(filter, offset) {

    offset = offset || 0;

    var result = Em.A();
    result.set('loading', true);
    return Discourse.ajax('/admin/flags/' + filter + '.json?offset=' + offset).then(function(data) {
      var userLookup = {};
      _.each(data.users,function(user) {
        userLookup[user.id] = Discourse.AdminUser.create(user);
      });
      _.each(data.posts,function(post) {
        var f = Discourse.FlaggedPost.create(post);
        f.userLookup = userLookup;
        result.pushObject(f);
      });
      result.set('loading', false);
      return result;
    });
  }
});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A model for a git commit to the discourse repo, fetched from the github.com api.

  @class GithubCommit
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.GithubCommit = Discourse.Model.extend({
  gravatarUrl: function(){
    if( this.get('author') && this.get('author.gravatar_id') ){
      return("https://www.gravatar.com/avatar/" + this.get('author.gravatar_id') + ".png?s=38&r=pg&d=identicon");
    } else {
      return "https://www.gravatar.com/avatar/b30fff48d257cdd17c4437afac19fd30.png?s=38&r=pg&d=identicon";
    }
  }.property("commit"),

  commitUrl: function(){
    return("https://github.com/discourse/discourse/commit/" + this.get('sha'));
  }.property("sha"),

  timeAgo: function() {
    return moment(this.get('commit.committer.date')).relativeAge({format: 'medium', leaveAgo: true});
  }.property("commit.committer.date")
});

Discourse.GithubCommit.reopenClass({
  findAll: function() {
    var result = Em.A();
    Discourse.ajax( "https://api.github.com/repos/discourse/discourse/commits?callback=callback", {
      dataType: 'jsonp',
      type: 'get',
      data: { per_page: 40 }
    }).then(function (response) {
      _.each(response.data,function(commit) {
        result.pushObject( Discourse.GithubCommit.create(commit) );
      });
    });
    return result;
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.Group = Discourse.Model.extend({
  loaded: false,

  userCountDisplay: function(){
    var c = this.get('user_count');
    // don't display zero its ugly
    if(c > 0) {
      return c;
    }
  }.property('user_count'),

  load: function() {
    var id = this.get('id');
    if(id && !this.get('loaded')) {
      var group = this;
      Discourse.ajax('/admin/groups/' + this.get('id') + '/users').then(function(payload){
        var users = Em.A();
        _.each(payload,function(user){
          users.addObject(Discourse.User.create(user));
        });
        group.set('users', users);
        group.set('loaded', true);
      });
    }
  },

  usernames: function() {
    var users = this.get('users');
    var usernames = "";
    if(users) {
      usernames = _.map(users, function(user){
        return user.get('username');
      }).join(',');
    }
    return usernames;
  }.property('users'),

  destroy: function(){
    if(!this.id) return;

    var group = this;
    group.set('disableSave', true);

    return Discourse.ajax("/admin/groups/" + group.get('id'), {type: "DELETE"})
      .then(function(){
        return true;
      }, function(error) {
        group.set('disableSave', false);
        bootbox.alert(I18n.t("admin.groups.delete_failed"));
        return false;
      });
  },

  create: function(){
    var group = this;
    group.set('disableSave', true);

    return Discourse.ajax("/admin/groups", {type: "POST", data: {
      group: {
        name: this.get('name'),
        usernames: this.get('usernames')
      }
    }}).then(function(resp) {
      group.set('disableSave', false);
      group.set('id', resp.id);
    }, function (error) {
      group.set('disableSave', false);
      if (error && error.responseText) {
        bootbox.alert($.parseJSON(error.responseText).errors);
      }
      else {
        bootbox.alert(I18n.t('generic_error'));
      }
    });
  },

  save: function(){
    var group = this;
    group.set('disableSave', true);

    return Discourse.ajax("/admin/groups/" + this.get('id'), {
      type: "PUT",
      data: {
        group: {
          name: this.get('name'),
          usernames: this.get('usernames')
        }
      },
      complete: function(){
        group.set('disableSave', false);
      }
    }).then(null, function(e){
      var message = $.parseJSON(e.responseText).errors;
      bootbox.alert(message);
    });
  }

});

Discourse.Group.reopenClass({
  findAll: function(){
    var list = Discourse.SelectableArray.create();

    Discourse.ajax("/admin/groups.json").then(function(groups){
      _.each(groups,function(group){
        list.addObject(Discourse.Group.create(group));
      });
    });

    return list;
  },

  find: function(id) {
    var promise = new Em.Deferred();

    setTimeout(function(){
      promise.resolve(Discourse.Group.create({id: 1, name: "all mods", members: ["A","b","c"]}));
    }, 1000);

    return promise;
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.Report = Discourse.Model.extend({
  reportUrl: function() {
    return("/admin/reports/" + this.get('type'));
  }.property('type'),

  valueAt: function(numDaysAgo) {
    if (this.data) {
      var wantedDate = moment().subtract('days', numDaysAgo).format('YYYY-MM-DD');
      var item = this.data.find( function(d, i, arr) { return d.x === wantedDate; } );
      if (item) {
        return item.y;
      }
    }
    return 0;
  },

  sumDays: function(startDaysAgo, endDaysAgo) {
    if (this.data) {
      var earliestDate = moment().subtract('days', endDaysAgo).startOf('day');
      var latestDate = moment().subtract('days',startDaysAgo).startOf('day');
      var d, sum = 0;
      _.each(this.data,function(datum){
        d = moment(datum.x);
        if(d >= earliestDate && d <= latestDate) {
          sum += datum.y;
        }
      });
      return sum;
    }
  },

  todayCount: function() {
    return this.valueAt(0);
  }.property('data'),

  yesterdayCount: function() {
    return this.valueAt(1);
  }.property('data'),

  lastSevenDaysCount: function() {
    return this.sumDays(1,7);
  }.property('data'),

  lastThirtyDaysCount: function() {
    return this.sumDays(1,30);
  }.property('data'),

  sevenDaysAgoCount: function() {
    return this.valueAt(7);
  }.property('data'),

  thirtyDaysAgoCount: function() {
    return this.valueAt(30);
  }.property('data'),

  yesterdayTrend: function() {
    var yesterdayVal = this.valueAt(1);
    var twoDaysAgoVal = this.valueAt(2);
    if ( yesterdayVal > twoDaysAgoVal ) {
      return 'trending-up';
    } else if ( yesterdayVal < twoDaysAgoVal ) {
      return 'trending-down';
    } else {
      return 'no-change';
    }
  }.property('data'),

  sevenDayTrend: function() {
    var currentPeriod = this.sumDays(1,7);
    var prevPeriod = this.sumDays(8,14);
    if ( currentPeriod > prevPeriod ) {
      return 'trending-up';
    } else if ( currentPeriod < prevPeriod ) {
      return 'trending-down';
    } else {
      return 'no-change';
    }
  }.property('data'),

  thirtyDayTrend: function() {
    if( this.get('prev30Days') ) {
      var currentPeriod = this.sumDays(1,30);
      if( currentPeriod > this.get('prev30Days') ) {
        return 'trending-up';
      } else if ( currentPeriod < this.get('prev30Days') ) {
        return 'trending-down';
      }
    }
    return 'no-change';
  }.property('data', 'prev30Days'),

  icon: function() {
    switch( this.get('type') ) {
    case 'flags':
      return 'icon-flag';
    case 'likes':
      return 'icon-heart';
    default:
      return null;
    }
  }.property('type'),

  percentChangeString: function(val1, val2) {
    var val = ((val1 - val2) / val2) * 100;
    if( isNaN(val) || !isFinite(val) ) {
      return null;
    } else if( val > 0 ) {
      return '+' + val.toFixed(0) + '%';
    } else {
      return val.toFixed(0) + '%';
    }
  },

  changeTitle: function(val1, val2, prevPeriodString) {
    var title = '';
    var percentChange = this.percentChangeString(val1, val2);
    if( percentChange ) {
      title += percentChange + ' change. ';
    }
    title += 'Was ' + val2 + ' ' + prevPeriodString + '.';
    return title;
  },

  yesterdayCountTitle: function() {
    return this.changeTitle( this.valueAt(1), this.valueAt(2),'two days ago');
  }.property('data'),

  sevenDayCountTitle: function() {
    return this.changeTitle( this.sumDays(1,7), this.sumDays(8,14), 'two weeks ago');
  }.property('data'),

  thirtyDayCountTitle: function() {
    return this.changeTitle( this.sumDays(1,30), this.get('prev30Days'), 'in the previous 30 day period');
  }.property('data')

});

Discourse.Report.reopenClass({
  find: function(type) {
    var model = Discourse.Report.create({type: type});
    Discourse.ajax("/admin/reports/" + type).then(function (json) {
      // Add a percent field to each tuple
      var maxY = 0;
      json.report.data.forEach(function (row) {
        if (row.y > maxY) maxY = row.y;
      });
      if (maxY > 0) {
        json.report.data.forEach(function (row) {
          row.percentage = Math.round((row.y / maxY) * 100);
        });
      }
      model.mergeAttributes(json.report);
      model.set('loaded', true);
    });
    return(model);
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an email address that is watched for during account registration,
  and an action is taken.

  @class ScreenedEmail
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedEmail = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_actions." + this.get('action'));
  }.property('action')
});

Discourse.ScreenedEmail.reopenClass({
  findAll: function(filter) {
    return Discourse.ajax("/admin/logs/screened_emails.json").then(function(screened_emails) {
      return screened_emails.map(function(b) {
        return Discourse.ScreenedEmail.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an IP address that is watched for during account registration
  (and possibly other times), and an action is taken.

  @class ScreenedIpAddress
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedIpAddress = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_ips.actions." + this.get('action_name'));
  }.property('action_name'),

  isBlocked: function() {
    return (this.get('action_name') === 'block');
  }.property('action_name'),

  actionIcon: function() {
    if (this.get('action_name') === 'block') {
      return this.get('blockIcon');
    } else {
      return this.get('doNothingIcon');
    }
  }.property('action_name'),

  blockIcon: function() {
    return 'icon-ban-circle';
  }.property(),

  doNothingIcon: function() {
    return 'icon-ok';
  }.property(),

  save: function() {
    return Discourse.ajax("/admin/logs/screened_ip_addresses" + (this.id ? '/' + this.id : '') + ".json", {
      type: this.id ? 'PUT' : 'POST',
      data: {ip_address: this.get('ip_address'), action_name: this.get('action_name')}
    });
  },

  destroy: function() {
    return Discourse.ajax("/admin/logs/screened_ip_addresses/" + this.get('id') + ".json", {type: 'DELETE'});
  }
});

Discourse.ScreenedIpAddress.reopenClass({
  findAll: function(filter) {
    return Discourse.ajax("/admin/logs/screened_ip_addresses.json").then(function(screened_ips) {
      return screened_ips.map(function(b) {
        return Discourse.ScreenedIpAddress.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents a URL that is watched for, and an action may be taken.

  @class ScreenedUrl
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.ScreenedUrl = Discourse.Model.extend({
  actionName: function() {
    return I18n.t("admin.logs.screened_actions." + this.get('action'));
  }.property('action')
});

Discourse.ScreenedUrl.reopenClass({
  findAll: function(filter) {
    return Discourse.ajax("/admin/logs/screened_urls.json").then(function(screened_urls) {
      return screened_urls.map(function(b) {
        return Discourse.ScreenedUrl.create(b);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with custom site content

  @class SiteContent
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteContent = Discourse.Model.extend({

  markdown: Ember.computed.equal('format', 'markdown'),
  plainText: Ember.computed.equal('format', 'plain'),
  html: Ember.computed.equal('format', 'html'),
  css: Ember.computed.equal('format', 'css'),

  /**
    Save the content

    @method save
    @return {jqXHR} a jQuery Promise object
  **/
  save: function() {
    return Discourse.ajax("/admin/site_contents/" + this.get('content_type'), {
      type: 'PUT',
      data: {content: this.get('content')}
    });
  }

});

Discourse.SiteContent.reopenClass({

  find: function(type) {
    return Discourse.ajax("/admin/site_contents/" + type).then(function (data) {
      return Discourse.SiteContent.create(data.site_content);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model that represents types of editing site content

  @class SiteContentType
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteContentType = Discourse.Model.extend({});

Discourse.SiteContentType.reopenClass({
  findAll: function() {
    return Discourse.ajax("/admin/site_content_types").then(function(data) {
      var contentTypes = Em.A();
      data.forEach(function (ct) {
        contentTypes.pushObject(Discourse.SiteContentType.create(ct));
      });
      return contentTypes;
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with site customizations.

  @class SiteCustomization
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteCustomization = Discourse.Model.extend({
  trackedProperties: ['enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'override_default_style'],

  init: function() {
    this._super();
    this.startTrackingChanges();
  },

  description: function() {
    return "" + this.name + (this.enabled ? ' (*)' : '');
  }.property('selected', 'name'),

  changed: function() {

    var _this = this;
    if(!this.originals) return false;

    var changed = _.some(this.trackedProperties,function(p) {
      return _this.originals[p] !== _this.get(p);
    });

    if(changed){
      this.set('savingStatus','');
    }

    return changed;

  }.property('override_default_style', 'enabled', 'name', 'stylesheet', 'header', 'mobile_stylesheet', 'mobile_header', 'originals'),

  startTrackingChanges: function() {
    var _this = this;
    var originals = {};
    _.each(this.trackedProperties,function(prop) {
      originals[prop] = _this.get(prop);
      return true;
    });
    this.set('originals', originals);
  },

  previewUrl: function() {
    return "/?preview-style=" + (this.get('key'));
  }.property('key'),

  disableSave: function() {
    return !this.get('changed') || this.get('saving');
  }.property('changed'),


  save: function() {
    this.set('savingStatus', I18n.t('saving'));
    this.set('saving',true);
    var data = {
      name: this.name,
      enabled: this.enabled,
      stylesheet: this.stylesheet,
      header: this.header,
      mobile_stylesheet: this.mobile_stylesheet,
      mobile_header: this.mobile_header,
      override_default_style: this.override_default_style
    };

    var siteCustomization = this;
    return Discourse.ajax("/admin/site_customizations" + (this.id ? '/' + this.id : ''), {
      data: { site_customization: data },
      type: this.id ? 'PUT' : 'POST'
    }).then(function (result) {
      if (!siteCustomization.id) {
        siteCustomization.set('id', result.id);
        siteCustomization.set('key', result.key);
      }
      siteCustomization.set('savingStatus', I18n.t('saved'));
      siteCustomization.set('saving',false);
      siteCustomization.startTrackingChanges();
    });

  },

  destroy: function() {
    if(!this.id) return;
    return Discourse.ajax("/admin/site_customizations/" + this.id, {
      type: 'DELETE'
    });
  }

});

var SiteCustomizations = Ember.ArrayProxy.extend({
  selectedItemChanged: function() {
    var selected = this.get('selectedItem');
    _.each(this.get('content'),function(i) {
      return i.set('selected', selected === i);
    });
  }.observes('selectedItem')
});

Discourse.SiteCustomization.reopenClass({
  findAll: function() {
    var customizations = SiteCustomizations.create({ content: [], loading: true });
    Discourse.ajax("/admin/site_customizations").then(function (data) {
      if (data) {
        _.each(data.site_customizations,function(c) {
          customizations.pushObject(Discourse.SiteCustomization.create(c.site_customizations));
        });
      }
      customizations.set('loading', false);
    });
    return customizations;
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for interacting with site settings.

  @class SiteSetting
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteSetting = Discourse.Model.extend({

  /**
    Is the boolean setting true?

    @property enabled
  **/
  enabled: function(key, value) {

    if (arguments.length === 1) {
      // get the boolean value of the setting
      if (this.blank('value')) return false;
      return this.get('value') === 'true';

    } else {
      // set the boolean value of the setting
      this.set('value', value ? 'true' : 'false');

      // We save booleans right away, it's not like a text field where it makes sense to
      // undo what you typed in.
      this.save();
    }

  }.property('value'),

  /**
    Has the user changed the setting? If so we should save it.

    @property dirty
  **/
  dirty: function() {
    return this.get('originalValue') !== this.get('value');
  }.property('originalValue', 'value'),

  /**
    Has the setting been overridden from its default value?

    @property overridden
  **/
  overridden: function() {
    var val = this.get('value');
    var defaultVal = this.get('default');

    if (val === null) val = '';
    if (defaultVal === null) defaultVal = '';

    return val.toString() !== defaultVal.toString();
  }.property('value'),

  /**
    Reset the setting to its original value.

    @method resetValue
  **/
  resetValue: function() {
    this.set('value', this.get('originalValue'));
  },

  /**
    Save the setting's value.

    @method save
  **/
  save: function() {
    // Update the setting
    var setting = this;
    return Discourse.ajax("/admin/site_settings/" + (this.get('setting')), {
      data: { value: this.get('value') },
      type: 'PUT'
    }).then(function() {
      setting.set('originalValue', setting.get('value'));
    });
  },

  validValues: function() {
    var vals, setting;
    vals = Em.A();
    setting = this;
    _.each(this.get('valid_values'), function(v) {
      if (v.name && v.name.length > 0) {
        if (setting.translate_names) {
          vals.addObject({name: I18n.t(v.name), value: v.value});
        } else {
          vals.addObject(v);
        }
      }
    });
    return vals;
  }.property('valid_values'),

  allowsNone: function() {
    if ( _.indexOf(this.get('valid_values'), '') >= 0 ) return 'admin.site_settings.none';
  }.property('valid_values')
});

Discourse.SiteSetting.reopenClass({

  findAll: function() {
    return Discourse.ajax("/admin/site_settings").then(function (settings) {
      // Group the results by category
      var categoryNames = [],
          categories = {},
          result = Em.A();
      _.each(settings.site_settings,function(s) {
        s.originalValue = s.value;
        if (!categoryNames.contains(s.category)) {
          categoryNames.pushObject(s.category);
          categories[s.category] = Em.A();
        }
        categories[s.category].pushObject(Discourse.SiteSetting.create(s));
      });
      _.each(categoryNames, function(n) {
        result.pushObject({nameKey: n, name: I18n.t('admin.site_settings.categories.' + n), siteSettings: categories[n]});
      });
      return result;
    });
  },

  update: function(key, value) {
    return Discourse.ajax("/admin/site_settings/" + key, {
      type: 'PUT',
      data: { value: value }
    });
  }

});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Represents an action taken by a staff member that has been logged.

  @class StaffActionLog
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.StaffActionLog = Discourse.Model.extend({
  showFullDetails: false,

  actionName: function() {
    return I18n.t("admin.logs.staff_actions.actions." + this.get('action_name'));
  }.property('action_name'),

  formattedDetails: function() {
    var formatted = "";
    formatted += this.format('email', 'email');
    formatted += this.format('admin.logs.ip_address', 'ip_address');
    if (!this.get('useCustomModalForDetails')) {
      formatted += this.format('admin.logs.staff_actions.new_value', 'new_value');
      formatted += this.format('admin.logs.staff_actions.previous_value', 'previous_value');
    }
    if (!this.get('useModalForDetails')) {
      if (this.get('details')) formatted += this.get('details') + '<br/>';
    }
    return formatted;
  }.property('ip_address', 'email'),

  format: function(label, propertyName) {
    if (this.get(propertyName)) {
      return ('<b>' + I18n.t(label) + ':</b> ' + this.get(propertyName) + '<br/>');
    } else {
      return '';
    }
  },

  useModalForDetails: function() {
    return (this.get('details') && this.get('details').length > 100);
  }.property('action_name'),

  useCustomModalForDetails: function() {
    return _.contains(['change_site_customization', 'delete_site_customization'], this.get('action_name'));
  }.property('action_name')
});

Discourse.StaffActionLog.reopenClass({
  create: function(attrs) {
    attrs = attrs || {};

    if (attrs.acting_user) {
      attrs.acting_user = Discourse.AdminUser.create(attrs.acting_user);
    }
    if (attrs.target_user) {
      attrs.target_user = Discourse.AdminUser.create(attrs.target_user);
    }
    return this._super(attrs);
  },

  findAll: function(filters) {
    return Discourse.ajax("/admin/logs/staff_action_logs.json", { data: filters }).then(function(staff_actions) {
      return staff_actions.map(function(s) {
        return Discourse.StaffActionLog.create(s);
      });
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Our data model for determining whether there's a new version of Discourse

  @class VersionCheck
  @extends Discourse.Model
  @namespace Discourse
  @module Discourse
**/

Discourse.VersionCheck = Discourse.Model.extend({

  noCheckPerformed: function() {
    return this.get('updated_at') === null;
  }.property('updated_at'),

  dataIsOld: function() {
    return this.get('version_check_pending') || moment().diff(moment(this.get('updated_at')), 'hours') >= 48;
  }.property('updated_at'),

  staleData: function() {
    return ( this.get('dataIsOld') ||
             (this.get('installed_version') !== this.get('latest_version') && this.get('missing_versions_count') === 0) ||
             (this.get('installed_version') === this.get('latest_version') && this.get('missing_versions_count') !== 0) );
  }.property('dataIsOld', 'missing_versions_count', 'installed_version', 'latest_version'),

  upToDate: function() {
    return this.get('missing_versions_count') === 0 || this.get('missing_versions_count') === null;
  }.property('missing_versions_count'),

  behindByOneVersion: function() {
    return this.get('missing_versions_count') === 1;
  }.property('missing_versions_count'),

  gitLink: function() {
    return "https://github.com/discourse/discourse/tree/" + this.get('installed_sha');
  }.property('installed_sha'),

  shortSha: function() {
    return this.get('installed_sha').substr(0,10);
  }.property('installed_sha')
});

Discourse.VersionCheck.reopenClass({
  find: function() {
    return Discourse.ajax('/admin/version_check').then(function(json) {
      return Discourse.VersionCheck.create(json);
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to api

  @class AdminApiRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminApiRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.ApiKey.find();
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to customization

  @class AdminCustomizeRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.SiteCustomization.findAll();
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles the default admin route

  @class AdminDashboardRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminDashboardRoute = Discourse.Route.extend({

  setupController: function(c) {
    this.fetchDashboardData(c);
    this.fetchGithubCommits(c);
  },

  fetchDashboardData: function(c) {
    if( !c.get('dashboardFetchedAt') || moment().subtract('minutes', 30).toDate() > c.get('dashboardFetchedAt') ) {
      c.set('dashboardFetchedAt', new Date());
      Discourse.AdminDashboard.find().then(function(d) {
        if( Discourse.SiteSettings.version_checks ){
          c.set('versionCheck', Discourse.VersionCheck.create(d.version_check));
        }
        _.each(d.reports,function(report){
          c.set(report.type, Discourse.Report.create(report));
        });

        var topReferrers = d.top_referrers;
        if (topReferrers && topReferrers.data) {
          d.top_referrers.data = topReferrers.data.map(function (user) {
            return Discourse.AdminUser.create(user);
          });
          c.set('top_referrers', topReferrers);
        }

        ['admins', 'moderators', 'blocked', 'suspended', 'top_traffic_sources', 'top_referred_topics', 'updated_at'].forEach(function(x) {
          c.set(x, d[x]);
        });

        c.set('loading', false);
      });
    }

    if( !c.get('problemsFetchedAt') || moment().subtract('minute',c.problemsCheckMinutes).toDate() > c.get('problemsFetchedAt') ) {
      c.set('problemsFetchedAt', new Date());
      c.loadProblems();
    }
  },

  fetchGithubCommits: function(c) {
    if( !c.get('commitsCheckedAt') || moment().subtract('hour',1).toDate() > c.get('commitsCheckedAt') ) {
      c.set('commitsCheckedAt', new Date());
      c.set('githubCommits', Discourse.GithubCommit.findAll());
    }
  }
});



// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles email routes

  @class AdminEmailRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailIndexRoute = Discourse.Route.extend({

  setupController: function(controller) {
    Discourse.EmailSettings.find().then(function (model) {
      controller.set('model', model);
    });
  },

  renderTemplate: function() {
    this.render('admin/templates/email_index', {into: 'adminEmail'});
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing email logs.

  @class AdminEmailLogsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminEmailLogsRoute = Discourse.Route.extend({
  model: function() {
    return Discourse.EmailLog.findAll();
  },

  renderTemplate: function() {
    this.render('admin/templates/email_logs', {into: 'adminEmail'});
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Previews the Email Digests

  @class AdminEmailPreviewDigest
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/


var oneWeekAgo = function() {
  return moment().subtract('days',7).format('YYYY-MM-DD');
};

Discourse.AdminEmailPreviewDigestRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.EmailPreview.findDigest(oneWeekAgo());
  },

  afterModel: function(model) {
    var controller = this.controllerFor('adminEmailPreviewDigest');
    controller.setProperties({
      model: model,
      lastSeen: oneWeekAgo(),
      showHtml: true
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminFlagsIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminFlags.active');
  }
});

Discourse.AdminFlagsRouteType = Discourse.Route.extend({
  model: function() {
    return Discourse.FlaggedPost.findAll(this.get('filter'));
  },

  setupController: function(controller, model) {
    var adminFlagsController = this.controllerFor('adminFlags');
    adminFlagsController.set('content', model);
    adminFlagsController.set('query', this.get('filter'));
  }

});

Discourse.AdminFlagsActiveRoute = Discourse.AdminFlagsRouteType.extend({
  filter: 'active'
});


Discourse.AdminFlagsOldRoute = Discourse.AdminFlagsRouteType.extend({
  filter: 'old'
});





// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes for admin groups

  @class AdminGroupsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminGroupsRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.Group.findAll();
  }

});



// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Index redirects to a default logs index.

  @class AdminLogsIndexRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminLogsIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminLogs.staffActionLogs');
  }
});

/**
  The route that lists staff actions that were logged.

  @class AdminLogsStaffActionLogsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsStaffActionLogsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/staff_action_logs', {into: 'adminLogs'});
  },

  setupController: function(controller) {
    var queryParams = Discourse.URL.get('queryParams');
    if (queryParams) {
      controller.set('filters', queryParams);
    }
    return controller.show();
  },

  actions: {
    showDetailsModal: function(logRecord) {
      Discourse.Route.showModal(this, 'admin_staff_action_log_details', logRecord);
      this.controllerFor('modal').set('modalClass', 'log-details-modal');
    },

    showCustomDetailsModal: function(logRecord) {
      Discourse.Route.showModal(this, logRecord.action_name + '_details', logRecord);
      this.controllerFor('modal').set('modalClass', 'tabbed-modal log-details-modal');
    }
  },

  deactivate: function() {
    this._super();

    // Clear any filters when we leave the route
    Discourse.URL.set('queryParams', null);
  }
});

/**
  The route that lists blocked email addresses.

  @class AdminLogsScreenedEmailsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedEmailsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_emails', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedEmails').show();
  }
});

/**
  The route that lists screened IP addresses.

  @class AdminLogsScreenedIpAddresses
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedIpAddressesRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_ip_addresses', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedIpAddresses').show();
  }
});

/**
  The route that lists screened URLs.

  @class AdminLogsScreenedUrlsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminLogsScreenedUrlsRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/logs/screened_urls', {into: 'adminLogs'});
  },

  setupController: function() {
    return this.controllerFor('adminLogsScreenedUrls').show();
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes for admin reports

  @class AdminReportsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminReportsRoute = Discourse.Route.extend({
  model: function(params) {
    return Discourse.Report.find(params.type);
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The base admin route

  @class AdminRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/admin');
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Builds the routes for the admin section

  @method buildRoutes
  @for Discourse.AdminRoute
**/

Discourse.Route.buildRoutes(function() {
  this.resource('admin', { path: '/admin' }, function() {
    this.route('dashboard', { path: '/' });
    this.resource('adminSiteSettings', { path: '/site_settings' }, function() {
      this.resource('adminSiteSettingsCategory', { path: 'category/:category_id'} );
    });


    this.resource('adminSiteContents', { path: '/site_contents' }, function() {
      this.resource('adminSiteContentEdit', {path: '/:content_type'});
    });

    this.resource('adminEmail', { path: '/email'}, function() {
      this.route('logs', { path: '/logs' });
      this.route('previewDigest', { path: '/preview-digest' });
    });

    this.route('customize', { path: '/customize' });
    this.route('api', {path: '/api'});

    this.resource('adminReports', { path: '/reports/:type' });

    this.resource('adminFlags', { path: '/flags' }, function() {
      this.route('index', { path: '/' });
      this.route('active', { path: '/active' });
      this.route('old', { path: '/old' });
    });

    this.resource('adminLogs', { path: '/logs' }, function() {
      this.route('staffActionLogs', { path: '/staff_action_logs' });
      this.route('screenedEmails', { path: '/screened_emails' });
      this.route('screenedIpAddresses', { path: '/screened_ip_addresses' });
      this.route('screenedUrls', { path: '/screened_urls' });
    });

    this.route('groups', {path: '/groups'});

    this.resource('adminUsers', { path: '/users' }, function() {
      this.resource('adminUser', { path: '/:username' });
      this.resource('adminUsersList', { path: '/list' }, function() {
        _.each(['active', 'new', 'pending', 'admins', 'moderators', 'blocked', 'suspended',
                'newuser', 'basic', 'regular', 'leaders', 'elders'], function(x) {
          this.route(x, { path: '/' + x });
        }, this);
      });
    });

  });
});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Allows users to customize site content

  @class AdminSiteContentEditRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteContentEditRoute = Discourse.Route.extend({

  serialize: function(model) {
    return {content_type: model.get('content_type')};
  },

  model: function(params) {
    var list = Discourse.SiteContentType.findAll();

    return list.then(function(items) {
      return items.findProperty("content_type", params.content_type);
    });
  },

  renderTemplate: function() {
    this.render('admin/templates/site_content_edit', {into: 'admin/templates/site_contents'});
  },

  exit: function() {
    this._super();
    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});
  },

  setupController: function(controller, model) {

    controller.set('loaded', false);
    controller.setProperties({
      model: model,
      saving: false,
      saved: false
    });

    Discourse.SiteContent.find(model.get('content_type')).then(function (sc) {
      controller.set('content', sc);
      controller.set('loaded', true);
    });
  }


});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Allows users to customize site content

  @class AdminSiteContentsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteContentsRoute = Discourse.Route.extend({

  model: function() {
    return Discourse.SiteContentType.findAll();
  },

  renderTemplate: function(controller, model) {
    this.render('admin/templates/site_contents', {into: 'admin/templates/admin'});
    this.render('admin/templates/site_contents_empty', {into: 'admin/templates/site_contents'});
  },

  setupController: function(controller, model) {
    controller.set('model', model);
  }
});



// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing and editing site settings within one category.

  @class AdminSiteSettingCategoryRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteSettingsCategoryRoute = Discourse.Route.extend({
  model: function(params) {
    // The model depends on user input, so let the controller do the work:
    this.controllerFor('adminSiteSettingsCategory').set('categoryNameKey', params.category_id);
    return Em.Object.create({
      nameKey: params.category_id,
      name: I18n.t('admin.site_settings.categories.' + params.category_id),
      siteSettings: this.controllerFor('adminSiteSettingsCategory').get('filteredContent')
    });
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to viewing and editing site settings.

  @class AdminSiteSettingsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSiteSettingsRoute = Discourse.Route.extend({
  model: function() {
    return Discourse.SiteSetting.findAll();
  },

  afterModel: function(siteSettings) {
    this.controllerFor('adminSiteSettings').set('allSiteSettings', siteSettings);
  }
});

/**
  Handles when you click the Site Settings tab in admin, but haven't
  chosen a category. It will redirect to the first category.
**/
Discourse.AdminSiteSettingsIndexRoute = Discourse.Route.extend({
  model: function() {
    this.transitionTo('adminSiteSettingsCategory', this.modelFor('adminSiteSettings')[0].nameKey);
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles routes related to users in the admin section.

  @class AdminUserRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUserRoute = Discourse.Route.extend({

  serialize: function(params) {
    return { username: Em.get(params, 'username').toLowerCase() };
  },

  model: function(params) {
    return Discourse.AdminUser.find(Em.get(params, 'username').toLowerCase());
  },

  renderTemplate: function() {
    this.render({into: 'admin/templates/admin'});
  },

  afterModel: function(adminUser) {
    var controller = this.controllerFor('adminUser');

    adminUser.loadDetails().then(function () {
      adminUser.setOriginalTrustLevel();
      controller.set('model', adminUser);
      window.scrollTo(0, 0);
    });
  },

  actions: {
    showSuspendModal: function(user) {
      Discourse.Route.showModal(this, 'admin_suspend_user', user);
      this.controllerFor('modal').set('modalClass', 'suspend-user-modal');
    }
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles the route that deals with listing users

  @class AdminUsersListRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUsersListRoute = Discourse.Route.extend({
  renderTemplate: function() {
    this.render('admin/templates/users_list', {into: 'admin/templates/admin'});
  }
});

/**
  Index should just redirect to active

  @class AdminUsersIndexRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListIndexRoute = Discourse.Route.extend({
  redirect: function() {
    this.transitionTo('adminUsersList.active');
  }
});

/**
  Handles the route that lists active users.

  @class AdminUsersListActiveRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListActiveRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('active');
  }
});

/**
  Handles the route that lists new users.

  @class AdminUsersListNewRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListNewRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('new');
  }
});

/**
  Handles the route that lists pending users.

  @class AdminUsersListNewRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListPendingRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('pending');
  }
});

/**
  Handles the route that lists admin users.

  @class AdminUsersListAdminsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListAdminsRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('admins');
  }
});

/**
  Handles the route that lists moderators.

  @class AdminUsersListModeratorsRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListModeratorsRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('moderators');
  }
});

/**
  Handles the route that lists blocked users.

  @class AdminUsersListBlockedRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListBlockedRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('blocked');
  }
});

/**
  Handles the route that lists suspended users.

  @class AdminUsersListSuspendedRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListSuspendedRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('suspended');
  }
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  Handles the route that lists users at trust level 0.

  @class AdminUsersListNewuserRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminUsersListNewuserRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('newuser');
  }  
});

/**
  Handles the route that lists users at trust level 1.

  @class AdminUsersListBasicRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListBasicRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('basic');
  }  
});

/**
  Handles the route that lists users at trust level 2.

  @class AdminUsersListRegularRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListRegularRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('regular');
  }  
});

/**
  Handles the route that lists users at trust level 3.

  @class AdminUsersListLeadersRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListLeadersRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('leader');
  }  
});

/**
  Handles the route that lists users at trust level 4.

  @class AdminUsersListEldersRoute
  @extends Discourse.Route
  @namespace Discourse
  @module Discourse
**/
Discourse.AdminUsersListEldersRoute = Discourse.Route.extend({
  setupController: function() {
    return this.controllerFor('adminUsersList').show('elder');
  }  
});


// IIFE Wrapped Content Ends

 })(this);Ember.TEMPLATES["admin/templates/admin"] = Ember.Handlebars.compile("<div class=\"container\">\n    <div class=\"row\">\n      <div class=\"full-width\">\n  \n        <ul class=\"nav nav-pills\">\n          <li>{{#link-to 'admin.dashboard'}}{{i18n admin.dashboard.title}}{{/link-to}}</li>\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'adminSiteSettings'}}{{i18n admin.site_settings.title}}{{/link-to}}</li>\n            <li>{{#link-to 'adminSiteContents'}}{{i18n admin.site_content.title}}{{/link-to}}</li>\n          {{/if}}\n          <li>{{#link-to 'adminUsersList'}}{{i18n admin.users.title}}{{/link-to}}</li>\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'admin.groups'}}{{i18n admin.groups.title}}{{/link-to}}</li>\n          {{/if}}\n          <li>{{#link-to 'adminEmail'}}{{i18n admin.email.title}}{{/link-to}}</li>\n          <li>{{#link-to 'adminFlags'}}{{i18n admin.flags.title}}{{/link-to}}</li>\n          <li>{{#link-to 'adminLogs'}}{{i18n admin.logs.title}}{{/link-to}}</li>\n          {{#if currentUser.admin}}\n            <li>{{#link-to 'admin.customize'}}{{i18n admin.customize.title}}{{/link-to}}</li>\n            <li>{{#link-to 'admin.api'}}{{i18n admin.api.title}}{{/link-to}}</li>\n          {{/if}}\n        </ul>\n  \n        <div class='boxed white admin-content'>\n          <div class='admin-contents'>\n            {{outlet}}\n          </div>\n        </div>\n  \n      </div>\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/api"] = Ember.Handlebars.compile("{{#if model}}\n    <table class='api-keys'>\n    <tr>\n      <th>{{i18n admin.api.key}}</th>\n      <th>{{i18n admin.api.user}}</th>\n      <th>&nbsp;</th>\n    </tr>\n    {{#each model}}\n      <tr>\n        <td class='key'>{{key}}</td>\n        <td>\n          {{#if user}}\n            {{#link-to 'adminUser' user}}\n              {{avatar user imageSize=\"small\"}}\n            {{/link-to}}\n          {{else}}\n            {{i18n admin.api.all_users}}\n          {{/if}}\n        </td>\n        <td>\n          <button class='btn' {{action regenerateKey this}}>{{i18n admin.api.regenerate}}</button>\n          <button class='btn' {{action revokeKey this}}>{{i18n admin.api.revoke}}</button>\n        </td>\n      </tr>\n    {{/each}}\n    </table>\n  {{else}}\n    <p>{{i18n admin.api.none}}</p>\n  {{/if}}\n  \n  {{#unless hasMasterKey}}\n    <button class='btn' {{action generateMasterKey}}>{{i18n admin.api.generate_master}}</button>\n  {{/unless }}");
Ember.TEMPLATES["admin/templates/commits"] = Ember.Handlebars.compile("<div class=\"commits-widget\">\n    <div class=\"header\" {{action \"goToGithub\"}}>\n      <h1>\n        <i class=\"icon icon-github\"></i>\n        {{i18n admin.commits.latest_changes}}\n      </h1>\n    </div>\n    <ul class=\"commits-list\">\n      {{#each controller}}\n        <li>\n          <div class=\"left\">\n            <img {{bindAttr src=\"gravatarUrl\"}}>\n          </div>\n          <div class=\"right\">\n            <span class=\"commit-message\"><a {{bindAttr href=\"commitUrl\"}} target=\"_blank\">{{ commit.message }}</a></span><br/>\n            <span class=\"commit-meta\">{{i18n admin.commits.by}} <span class=\"committer-name\">{{ commit.author.name }}</span> - <span class=\"commit-time\">{{{ timeAgo }}}</span></span>\n          </div>\n        </li>\n      {{/each}}\n    </ul>\n  </div>");
Ember.TEMPLATES["admin/templates/customize"] = Ember.Handlebars.compile("<div class='content-list span6'>\n    <h3>{{i18n admin.customize.long_title}}</h3>\n    <ul>\n      {{#each model}}\n      <li><a {{action selectStyle this}} {{bindAttr class=\"this.selected:active\"}}>{{this.description}}</a></li>\n      {{/each}}\n    </ul>\n    <button {{action newCustomization}} class='btn'>{{i18n admin.customize.new}}</button>\n  </div>\n  \n  \n  {{#if selectedItem}}\n  <div class='current-style'>\n    {{#with selectedItem}}\n      {{textField class=\"style-name\" value=name}}\n  \n      <div class='admin-controls'>\n        <ul class=\"nav nav-pills\">\n          <li>\n            <a {{bindAttr class=\"view.stylesheetActive:active\"}}{{action selectStylesheet href=\"true\" target=\"view\"}}>{{i18n admin.customize.css}}</a>\n          </li>\n          <li>\n            <a {{bindAttr class=\"view.headerActive:active\"}}{{action selectHeader href=\"true\" target=\"view\"}}>{{i18n admin.customize.header}}</a>\n          </li>\n          <li>\n            <a {{bindAttr class=\"view.mobileStylesheetActive:active\"}}{{action selectMobileStylesheet href=\"true\" target=\"view\"}}>{{i18n admin.customize.mobile_css}}</a>\n          </li>\n          <li>\n            <a {{bindAttr class=\"view.mobileHeaderActive:active\"}}{{action selectMobileHeader href=\"true\" target=\"view\"}}>{{i18n admin.customize.mobile_header}}</a>\n          </li>\n        </ul>\n      </div>\n  \n      {{#if view.headerActive}}\n        {{aceEditor content=header mode=\"html\"}}\n      {{/if}}\n      {{#if view.stylesheetActive}}\n        {{aceEditor content=stylesheet mode=\"scss\"}}\n      {{/if}}\n      {{#if view.mobileHeaderActive}}\n        {{aceEditor content=mobile_header mode=\"html\"}}\n      {{/if}}\n      {{#if view.mobileStylesheetActive}}\n        {{aceEditor content=mobile_stylesheet mode=\"scss\"}}\n      {{/if}}\n    {{/with}}\n    <br>\n    <div class='status-actions'>\n      <span>{{i18n admin.customize.override_default}} {{view Ember.Checkbox checkedBinding=\"selectedItem.override_default_style\"}}</span>\n      <span>{{i18n admin.customize.enabled}}  {{view Ember.Checkbox checkedBinding=\"selectedItem.enabled\"}}</span>\n      {{#unless selectedItem.changed}}\n      <a class='preview-link' {{bindAttr href=\"selectedItem.previewUrl\"}} target='_blank'>{{i18n admin.customize.preview}}</a>\n      |\n      <a href=\"/?preview-style=\" target='_blank'>{{i18n admin.customize.undo_preview}}</a><br>\n      {{/unless}}\n    </div>\n  \n    <div class='buttons'>\n      <button {{action save}} {{bindAttr disabled=\"selectedItem.disableSave\"}} class='btn'>{{i18n admin.customize.save}}</button>\n      <span class='saving'>{{selectedItem.savingStatus}}</span>\n      <a {{action destroy}} class='delete-link'>{{i18n admin.customize.delete}}</a>\n    </div>\n  \n  </div>\n  {{else}}\n    <p class=\"about\">{{i18n admin.customize.about}}</p>\n  {{/if}}\n  <div class='clearfix'></div>");
Ember.TEMPLATES["admin/templates/dashboard"] = Ember.Handlebars.compile("<div class=\"dashboard-left\">\n    {{#if foundProblems}}\n      <div class=\"dashboard-stats detected-problems\">\n        <div class=\"look-here\"><i class=\"icon icon-warning-sign\"></i></div>\n        <div class=\"problem-messages\">\n          <p {{bindAttr class=\"loadingProblems:invisible\"}}>\n            {{i18n admin.dashboard.problems_found}}\n            <ul {{bindAttr class=\"loadingProblems:invisible\"}}>\n              {{#each problem in problems}}\n                <li>{{{problem}}}</li>\n              {{/each}}\n            </ul>\n          </p>\n          <p class=\"actions\">\n            <small>{{i18n admin.dashboard.last_checked}}: {{problemsTimestamp}}</small>\n            <button {{action refreshProblems}} class=\"btn btn-small\"><i class=\"icon icon-refresh\"></i>{{i18n admin.dashboard.refresh_problems}}</button>\n          </p>\n        </div>\n        <div class=\"clearfix\"></div>\n      </div>\n    {{else}}\n      {{#if thereWereProblems}}\n        <div class=\"dashboard-stats detected-problems\">\n          <div class=\"look-here\">&nbsp;</div>\n          <div class=\"problem-messages\">\n            <p>\n              {{i18n admin.dashboard.no_problems}}\n              <button {{action refreshProblems}} class=\"btn btn-small\"><i class=\"icon icon-refresh\"></i>{{i18n admin.dashboard.refresh_problems}}</button>\n            </p>\n          </div>\n          <div class=\"clearfix\"></div>\n        </div>\n      {{/if}}\n    {{/if}}\n  \n    {{#if Discourse.SiteSettings.version_checks}}\n      <div {{bindAttr class=\":dashboard-stats :version-check versionCheck.critical_updates:critical:normal\"}}>\n        <table class=\"table table-condensed table-hover\">\n          <thead>\n            <tr>\n              <th>&nbsp;</th>\n              <th>{{i18n admin.dashboard.installed_version}}</th>\n              <th>{{i18n admin.dashboard.latest_version}}</th>\n              <th>&nbsp;</th>\n              <th>&nbsp;</th>\n            </tr>\n          </thead>\n          {{#unless loading}}\n            <tbody>\n              <td class=\"title\">{{i18n admin.dashboard.version}}</td>\n              <td class=\"version-number\"><a {{bindAttr href=\"versionCheck.gitLink\"}} target=\"_blank\">{{ versionCheck.installed_version }}</a></td>\n  \n              {{#if versionCheck.noCheckPerformed}}\n                <td class=\"version-number\">&nbsp;</td>\n                <td class=\"face\">\n                  <span class=\"icon critical-updates-available\">☹</span>\n                </td>\n                <td class=\"version-notes\">\n                  <span class=\"normal-note\">{{i18n admin.dashboard.no_check_performed}}</span>\n                </td>\n              {{else}}\n                {{#if versionCheck.staleData}}\n                  <td class=\"version-number\">&nbsp;</td>\n                  <td class=\"face\">\n                    {{#if versionCheck.version_check_pending}}\n                      <span class='icon up-to-date'>☻</span>\n                    {{else}}\n                      <span class=\"icon critical-updates-available\">☹</span>\n                    {{/if}}\n                  </td>\n                  <td class=\"version-notes\">\n                    <span class=\"normal-note\">\n                      {{#if versionCheck.version_check_pending}}\n                        {{i18n admin.dashboard.version_check_pending}}\n                      {{else}}\n                        {{i18n admin.dashboard.stale_data}}\n                      {{/if}}\n                    </span>\n                  </td>\n                {{else}}\n                  <td class=\"version-number\">{{ versionCheck.latest_version }}</td>\n                  <td class=\"face\">\n                    {{#if versionCheck.upToDate }}\n                      <span class='icon up-to-date'>☻</span>\n                    {{else}}\n                      <span {{bindAttr class=\":icon versionCheck.critical_updates:critical-updates-available:updates-available\"}}>\n                        {{#if versionCheck.behindByOneVersion}}\n                          ☺\n                        {{else}}\n                          ☹\n                        {{/if}}\n                      </span>\n                    {{/if}}\n                  </td>\n                  <td class=\"version-notes\">\n                    {{#if versionCheck.upToDate }}\n                      {{i18n admin.dashboard.up_to_date}}\n                    {{else}}\n                      <span class=\"critical-note\">{{i18n admin.dashboard.critical_available}}</span>\n                      <span class=\"normal-note\">{{i18n admin.dashboard.updates_available}}</span>\n                      {{i18n admin.dashboard.please_upgrade}}\n                    {{/if}}\n                  </td>\n                {{/if}}\n              {{/if}}\n            </tbody>\n          {{/unless}}\n        </table>\n      </div>\n    {{/if}}\n  \n    <div class=\"dashboard-stats trust-levels\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>0</th>\n            <th>1</th>\n            <th>2</th>\n            <th>3</th>\n            <th>4</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin/templates/reports/trust_levels_report' users_by_trust_level tagName=\"tbody\" }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats totals\">\n      <table>\n        <tr>\n          <td class=\"title\"><i class='icon icon-trophy'></i> {{i18n admin.dashboard.admins}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.admins'}}{{admins}}{{/link-to}}</td>\n          <td class=\"title\"><i class='icon icon-ban-circle'></i> {{i18n admin.dashboard.suspended}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.suspended'}}{{suspended}}{{/link-to}}</td>\n        </tr>\n        <tr>\n          <td class=\"title\"><i class='icon icon-magic'></i> {{i18n admin.dashboard.moderators}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.moderators'}}{{moderators}}{{/link-to}}</td>\n          <td class=\"title\"><i class='icon icon-ban-circle'></i> {{i18n admin.dashboard.blocked}}</td>\n          <td class=\"value\">{{#link-to 'adminUsersList.blocked'}}{{blocked}}{{/link-to}}</td>\n        </tr>\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.last_7_days}}</th>\n            <th>{{i18n admin.dashboard.reports.last_30_days}}</th>\n            <th>{{i18n admin.dashboard.reports.all}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin_report_counts' signups }}\n          {{ render 'admin_report_counts' topics }}\n          {{ render 'admin_report_counts' posts }}\n          {{ render 'admin_report_counts' likes }}\n          {{ render 'admin_report_counts' flags }}\n          {{ render 'admin_report_counts' bookmarks }}\n          {{ render 'admin_report_counts' favorites }}\n          {{ render 'admin_report_counts' emails }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\" title=\"{{i18n admin.dashboard.private_messages_title}}\"><i class=\"icon icon-envelope\"></i> {{i18n admin.dashboard.private_messages_short}}</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.last_7_days}}</th>\n            <th>{{i18n admin.dashboard.reports.last_30_days}}</th>\n            <th>{{i18n admin.dashboard.reports.all}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin_report_counts' user_to_user_private_messages }}\n          {{ render 'admin_report_counts' system_private_messages }}\n          {{ render 'admin_report_counts' notify_moderators_private_messages }}\n          {{ render 'admin_report_counts' notify_user_private_messages }}\n          {{ render 'admin_report_counts' moderator_warning_private_messages }}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th>&nbsp;</th>\n            <th>{{i18n admin.dashboard.reports.today}}</th>\n            <th>{{i18n admin.dashboard.reports.yesterday}}</th>\n            <th>{{i18n admin.dashboard.reports.7_days_ago}}</th>\n            <th>{{i18n admin.dashboard.reports.30_days_ago}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{ render 'admin/templates/reports/per_day_counts_report' visits tagName=\"tbody\"}}\n        {{/unless}}\n      </table>\n    </div>\n  </div>\n  \n  <div class=\"dashboard-right\">\n    {{ render 'admin/templates/commits' githubCommits }}\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_referred_topics.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_referred_topics.ytitles.num_clicks}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each data in top_referred_topics.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">\n                  <div class=\"referred-topic-title\">\n                    <div class=\"overflow-ellipsis\">\n                      <a href=\"/t/{{unbound data.topic_slug}}/{{unbound data.topic_id}}\">{{data.topic_title}}</a>\n                    </div>\n                  </div>\n                </td>\n                <td class=\"value\">{{data.num_clicks}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_traffic_sources.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_traffic_sources.ytitles.num_clicks}}</th>\n            <th>{{top_traffic_sources.ytitles.num_topics}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each top_traffic_sources.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">{{domain}}</td>\n                <td class=\"value\">{{num_clicks}}</td>\n                <td class=\"value\">{{num_topics}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  \n    <div class=\"dashboard-stats\">\n      <table class=\"table table-condensed table-hover\">\n        <thead>\n          <tr>\n            <th class=\"title\">{{top_referrers.title}} ({{i18n admin.dashboard.reports.last_30_days}})</th>\n            <th>{{top_referrers.ytitles.num_clicks}}</th>\n            <th>{{top_referrers.ytitles.num_topics}}</th>\n          </tr>\n        </thead>\n        {{#unless loading}}\n          {{#each top_referrers.data}}\n            <tbody>\n              <tr>\n                <td class=\"title\">{{#link-to 'adminUser' this}}{{unbound username}}{{/link-to}}</td>\n                <td class=\"value\">{{num_clicks}}</td>\n                <td class=\"value\">{{num_topics}}</td>\n              </tr>\n            </tbody>\n          {{/each}}\n        {{/unless}}\n      </table>\n    </div>\n  </div>\n  <div class='clearfix'></div>\n  \n  <div class=\"dashboard-stats pull-right\">\n    <div class=\"pull-right\">{{i18n admin.dashboard.last_updated}} {{updatedTimestamp}}</div>\n    <div class='clearfix'></div>\n  </div>\n  <div class='clearfix'></div>");
Ember.TEMPLATES["admin/templates/email"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminEmail.index'}}{{i18n admin.email.settings}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.logs'}}{{i18n admin.email.logs}}{{/link-to}}</li>\n        <li>{{#link-to 'adminEmail.previewDigest'}}{{i18n admin.email.preview_digest}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  {{outlet}}");
Ember.TEMPLATES["admin/templates/email_index"] = Ember.Handlebars.compile("<table class=\"table\">\n    <tr>\n      <th>{{i18n admin.email.delivery_method}}</th>\n      <td>{{model.delivery_method}}</td>\n    </tr>\n  \n    {{#each model.settings}}\n      <tr>\n        <th style='width: 25%'>{{name}}</th>\n        <td>{{value}}</td>\n      </tr>\n    {{/each}}\n  </table>\n  \n  <div class='admin-controls'>\n    <div class='span5 controls'>\n      {{textField value=testEmailAddress placeholderKey=\"admin.email.test_email_address\"}}\n    </div>\n    <div class='span10 controls'>\n      <button class='btn' {{action sendTestEmail}} {{bindAttr disabled=\"sendTestEmailDisabled\"}}>{{i18n admin.email.send_test}}</button>\n      {{#if sentTestEmail}}<span class='result-message'>{{i18n admin.email.sent_test}}</span>{{/if}}\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/email_logs"] = Ember.Handlebars.compile("<table class='table'>\n    <thead>\n      <tr>\n        <th>{{i18n admin.email.sent_at}}</th>\n        <th>{{i18n admin.email.user}}</th>\n        <th>{{i18n admin.email.to_address}}</th>\n        <th>{{i18n admin.email.email_type}}</th>\n        <th>{{i18n admin.email.reply_key}}</th>\n      </tr>\n    </thead>\n  \n    {{#if model.length}}\n      {{#groupedEach model}}\n        <tr>\n          <td>{{date created_at}}</td>\n          <td>\n            {{#if user}}\n              {{#link-to 'adminUser' user}}{{avatar user imageSize=\"tiny\"}}{{/link-to}}\n              {{#link-to 'adminUser' user}}{{user.username}}{{/link-to}}\n            {{else}}\n              &mdash;\n            {{/if}}\n          </td>\n          <td><a href='mailto:{{unbound to_address}}'>{{to_address}}</a></td>\n          <td>{{email_type}}</td>\n          <td>{{reply_key}}</td>\n        </tr>\n      {{/groupedEach}}\n    {{/if}}\n  \n  </table>");
Ember.TEMPLATES["admin/templates/email_preview_digest"] = Ember.Handlebars.compile("<p>{{i18n admin.email.preview_digest_desc}}</p>\n  \n  <div class='admin-controls'>\n    <div class='span7 controls'>\n      <label for='last-seen'>{{i18n admin.email.last_seen_user}}</label>\n      {{input type=\"date\" value=lastSeen id=\"last-seen\"}}\n    </div>\n    <div class='span5'>\n      <button class='btn' {{action refresh}}>{{i18n admin.email.refresh}}</button>\n    </div>\n    <div class=\"span7 toggle\">\n      <label>{{i18n admin.email.format}}</label>\n      {{#if showHtml}}\n        <span>{{i18n admin.email.html}}</span> | <a href='#' {{action toggleShowHtml}}>{{i18n admin.email.text}}</a>\n      {{else}}\n        <a href='#' {{action toggleShowHtml}}>{{i18n admin.email.html}}</a> | <span>{{i18n admin.email.text}}</span>\n      {{/if}}\n    </div>\n  </div>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if showHtml}}\n      {{{html_content}}}\n    {{else}}\n      <pre>{{{text_content}}}</pre>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/flags"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminFlags.active'}}{{i18n admin.flags.active}}{{/link-to}}</li>\n        <li>{{#link-to 'adminFlags.old'}}{{i18n admin.flags.old}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  {{#if model.loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n      <table class='admin-flags'>\n        <thead>\n          <tr>\n            <th class='user'></th>\n            <th class='excerpt'></th>\n            <th class='flaggers'>{{i18n admin.flags.flagged_by}}</th>\n            <th class='last-flagged'></th>\n            <th class='action'></th>\n          </tr>\n        </thead>\n        <tbody>\n          {{#each flaggedPost in content}}\n          <tr {{bindAttr class=\"flaggedPost.extraClasses\"}}>\n  \n            <td class='user'>{{#if flaggedPost.user}}{{#link-to 'adminUser' flaggedPost.user}}{{avatar flaggedPost.user imageSize=\"small\"}}{{/link-to}}{{/if}}</td>\n  \n            <td class='excerpt'>{{#if flaggedPost.topicHidden}}<i title='{{i18n topic_statuses.invisible.help}}' class='icon icon-eye-close'></i> {{/if}}<h3><a href='{{unbound flaggedPost.url}}'>{{flaggedPost.title}}</a></h3><br>{{{flaggedPost.excerpt}}}\n            </td>\n  \n            <td class='flaggers'>\n              <table>\n                {{#each flaggedPost.flaggers}}\n                <tr>\n                  <td>\n                    {{#link-to 'adminUser' this.user}}{{avatar this.user imageSize=\"small\"}} {{/link-to}}\n                  </td>\n                  <td>\n                    {{date this.flaggedAt}}\n                  </td>\n                  <td>\n                    {{this.flagType}}\n                  </td>\n                </tr>\n                {{/each}}\n              </table>\n            </td>\n  \n          </tr>\n  \n            {{#each flaggedPost.messages}}\n              <tr>\n                <td></td>\n                <td class='message'>\n                  <div>\n                    {{#link-to 'adminUser' user}}{{avatar user imageSize=\"small\"}}{{/link-to}}\n                    {{message}}\n                    {{#unless bySystemUser}}\n                      <a href=\"{{unbound permalink}}\"><button class='btn'><i class=\"icon-reply\"></i> {{i18n admin.flags.view_message}}</button></a>\n                    {{/unless}}\n                  </div>\n                </td>\n                <td></td>\n                <td></td>\n              </tr>\n            {{/each}}\n  \n          <tr>\n              <td colspan=\"4\" class=\"action\">\n              {{#if adminActiveFlagsView}}\n                {{#if flaggedPost.postHidden}}\n                  <button title='{{i18n admin.flags.disagree_unhide_title}}' class='btn' {{action disagreeFlags flaggedPost}}><i class=\"icon-thumbs-down\"></i>  {{i18n admin.flags.disagree_unhide}}</button>\n                  <button title='{{i18n admin.flags.defer_title}}' class='btn' {{action deferFlags flaggedPost}}><i class=\"icon-external-link\"></i> {{i18n admin.flags.defer}}</button>\n                {{else}}\n                  <button title='{{i18n admin.flags.agree_hide_title}}' class='btn' {{action agreeFlags flaggedPost}}><i class=\"icon-thumbs-up\"></i> {{i18n admin.flags.agree_hide}}</button>\n                  <button title='{{i18n admin.flags.disagree_title}}' class='btn' {{action disagreeFlags flaggedPost}}><i class=\"icon-thumbs-down\"></i> {{i18n admin.flags.disagree}}</button>\n                {{/if}}\n  \n                {{#if flaggedPost.canDeleteAsSpammer}}\n                  <button title='{{i18n admin.flags.delete_spammer_title}}' class=\"btn\" {{action deleteSpammer flaggedPost}}><i class=\"icon icon-warning-sign\"></i> {{i18n flagging.delete_spammer}}</button>\n                {{/if}}\n  \n                <button title='{{i18n admin.flags.delete_post_title}}' class='btn' {{action deletePost flaggedPost}}><i class=\"icon-trash\"></i> {{i18n admin.flags.delete_post}}</button>\n              {{/if}}\n              </td>\n          </tr>\n  \n          {{/each}}\n  \n        </tbody>\n      </table>\n      {{#if view.loading}}\n        <div class='admin-loading'>{{i18n loading}}</div>\n      {{/if}}\n  \n    {{else}}\n      <p>{{i18n admin.flags.no_results}}</p>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/groups"] = Ember.Handlebars.compile("<div class='row groups'>\n    <div class='content-list span6'>\n      <h3>{{i18n admin.groups.edit}}</h3>\n      <ul>\n        {{#each group in model}}\n          <li>\n          <a href=\"#\" {{action \"edit\" group}} {{bindAttr class=\"group.active\"}}>{{group.name}} <span class=\"count\">{{group.userCountDisplay}}</span></a>\n          </li>\n        {{/each}}\n      </ul>\n      <div class='controls'>\n        <button class='btn' {{bindAttr disabled=\"refreshingAutoGroups\"}} {{action \"refreshAutoGroups\"}}>Refresh</button>\n        <button class='btn' {{action newGroup}}>New</button>\n      </div>\n    </div>\n  \n    <div class='content-editor'>\n      {{#if model.active}}\n        {{#if model.active.loaded}}\n          {{#with model.active}}\n            {{#if automatic}}\n              <h3>{{name}}</h3>\n            {{else}}\n              {{textField value=name placeholderKey=\"admin.groups.name_placeholder\"}}\n            {{/if}}\n  \n            {{userSelector usernames=usernames id=\"group-users\" placeholderKey=\"admin.groups.selector_placeholder\" tabindex=\"1\" disabledBinding=\"automatic\"}}\n            <div class='controls'>\n              {{#unless automatic}}\n                <button {{action save this}} {{bindAttr disabled=\"disableSave\"}} class='btn'>{{i18n admin.customize.save}}</button>\n                {{#if id}}\n                  <a {{action destroy this}} class='delete-link'>{{i18n admin.customize.delete}}</a>\n                {{/if}}\n              {{else}}\n                {{i18n admin.groups.can_not_edit_automatic}}\n              {{/unless}}\n            </div>\n          {{/with}}\n        {{else}}\n          <div class='spinner'>{{i18n loading}}</div>\n        {{/if}}\n      {{else}}\n        {{i18n admin.groups.about}}\n      {{/if}}\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/logs"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminLogs.staffActionLogs'}}{{i18n admin.logs.staff_actions.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedEmails'}}{{i18n admin.logs.screened_emails.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedIpAddresses'}}{{i18n admin.logs.screened_ips.title}}{{/link-to}}</li>\n        <li>{{#link-to 'adminLogs.screenedUrls'}}{{i18n admin.logs.screened_urls.title}}{{/link-to}}</li>\n      </ul>\n    </div>\n  </div>\n  \n  {{outlet}}");
Ember.TEMPLATES["admin/templates/logs/_site_customization_change_details"] = Ember.Handlebars.compile("<section class=\"field\">\n    <b>{{i18n admin.customize.css}}</b>:\n    {{#if stylesheet}}\n      ({{i18n character_count count=stylesheet.length}})\n    {{/if}}\n    <br/>\n    {{textarea value=stylesheet class=\"plain\"}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.header}}</b>:\n    {{#if header}}\n      ({{i18n character_count count=header.length}})\n    {{/if}}\n    <br/>\n    {{textarea value=header class=\"plain\"}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.enabled}}</b>: {{enabled}}\n  </section>\n  <section class=\"field\">\n    <b>{{i18n admin.customize.override_default}}</b>: {{override_default_style}}\n  </section>");
Ember.TEMPLATES["admin/templates/logs/details_modal"] = Ember.Handlebars.compile("<div class=\"modal-body\">\n    <pre>{{details}}</pre>\n  </div>\n  <div class=\"modal-footer\">\n    <button class='btn btn-primary' {{action closeModal}}>{{i18n close}}</button>\n  </div>");
Ember.TEMPLATES["admin/templates/logs/screened_emails"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_emails.description}}</p>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table screened-emails'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first email\">{{i18n admin.logs.screened_emails.email}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"col heading ip_address\">{{i18n admin.logs.ip_address}}</div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedEmailsListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_emails_list_item"] = Ember.Handlebars.compile("<div class=\"col first email\">\n    <div class=\"overflow-ellipsis\" {{bindAttr title=\"email\"}}>{{email}}</div>\n  </div>\n  <div class=\"col action\">{{actionName}}</div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">{{unboundAgeWithTooltip last_match_at}}</div>\n  <div class=\"col created_at\">{{unboundAgeWithTooltip created_at}}</div>\n  <div class=\"col ip_address\">{{ip_address}}</div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/screened_ip_addresses"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_ips.description}}</p>\n  \n  {{screened-ip-address-form action=\"recordAdded\"}}\n  <br/>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table admin-logs-table screened-ip-addresses'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first ip_address\">{{i18n admin.logs.ip_address}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"col heading actions\"></div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedIpAddressesListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_ip_addresses_list_item"] = Ember.Handlebars.compile("<div class=\"col first ip_address\">\n    {{#if editing}}\n      {{textField value=ip_address autofocus=\"autofocus\"}}\n    {{else}}\n      <span {{action edit this}}>{{ip_address}}</span>\n    {{/if}}\n  </div>\n  <div class=\"col action\">\n    <i {{bindAttr class=\":icon actionIcon\"}}></i>\n    {{actionName}}\n  </div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">\n    {{#if last_match_at}}\n      {{unboundAgeWithTooltip last_match_at}}\n    {{/if}}\n  </div>\n  <div class=\"col created_at\">{{unboundAgeWithTooltip created_at}}</div>\n  <div class=\"col actions\">\n    {{#unless editing}}\n      <button class=\"btn btn-danger\" {{action destroy this}}><i class=\"icon icon-trash\"></i> {{i18n admin.logs.delete}}</button>\n      <button class=\"btn\" {{action edit this}}><i class=\"icon icon-pencil\"></i> {{i18n admin.logs.edit}}</button>\n      {{#if isBlocked}}\n        <button class=\"btn\" {{action allow this}}><i {{bindAttr class=\":icon doNothingIcon\"}}></i> {{i18n admin.logs.screened_ips.actions.do_nothing}}</button>\n      {{else}}\n        <button class=\"btn\" {{action block this}}><i {{bindAttr class=\":icon blockIcon\"}}></i> {{i18n admin.logs.screened_ips.actions.block}}</button>\n      {{/if}}\n    {{else}}\n      <button class=\"btn\" {{action save this}}>{{i18n admin.logs.save}}</button>\n      <a {{action cancel this}}>{{i18n cancel}}</a>\n    {{/unless}}\n  </div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/screened_urls"] = Ember.Handlebars.compile("<p>{{i18n admin.logs.screened_urls.description}}</p>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n  \n      <div class='table screened-urls'>\n        <div class=\"heading-container\">\n          <div class=\"col heading first domain\">{{i18n admin.logs.screened_urls.domain}}</div>\n          <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n          <div class=\"col heading match_count\">{{i18n admin.logs.match_count}}</div>\n          <div class=\"col heading last_match_at\">{{i18n admin.logs.last_match_at}}</div>\n          <div class=\"col heading created_at\">{{i18n admin.logs.created_at}}</div>\n          <div class=\"clearfix\"></div>\n        </div>\n  \n        {{view Discourse.ScreenedUrlsListView contentBinding=\"controller\"}}\n      </div>\n  \n    {{else}}\n      {{i18n search.no_results}}\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/logs/screened_urls_list_item"] = Ember.Handlebars.compile("<div class=\"col first domain\">\n    <div class=\"overflow-ellipsis\" {{bindAttr title=\"domain\"}}>{{domain}}</div>\n  </div>\n  <div class=\"col action\">{{actionName}}</div>\n  <div class=\"col match_count\">{{match_count}}</div>\n  <div class=\"col last_match_at\">{{unboundAgeWithTooltip last_match_at}}</div>\n  <div class=\"col created_at\">{{unboundAgeWithTooltip created_at}}</div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/logs/site_customization_change_modal"] = Ember.Handlebars.compile("<div>\n    <ul class=\"nav nav-pills\">\n      <li {{bindAttr class=\"newSelected:active\"}}>\n        <a href=\"#\" {{action selectNew}}>{{i18n admin.logs.staff_actions.new_value}}</a>\n      </li>\n      <li {{bindAttr class=\"previousSelected:active\"}}>\n        <a href=\"#\" {{action selectPrevious}}>{{i18n admin.logs.staff_actions.previous_value}}</a>\n      </li>\n    </ul>\n    <div class=\"modal-body\">\n      <div {{bindAttr class=\":modal-tab :new-tab newSelected::invisible\"}}>\n        {{#if new_value}}\n          {{#with new_value}}\n            {{partial \"admin/templates/logs/site_customization_change_details\"}}\n          {{/with}}\n        {{else}}\n          {{i18n admin.logs.staff_actions.deleted}}\n        {{/if}}\n      </div>\n      <div {{bindAttr class=\":modal-tab :previous-tab previousSelected::invisible\"}}>\n        {{#if previous_value}}\n          {{#with previous_value}}\n            {{partial \"admin/templates/logs/site_customization_change_details\"}}\n          {{/with}}\n        {{else}}\n          {{i18n admin.logs.staff_actions.no_previous}}\n        {{/if}}\n      </div>\n    </div>\n    <div class=\"modal-footer\">\n      <button class='btn btn-primary' {{action closeModal}}>{{i18n close}}</button>\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/logs/staff_action_logs"] = Ember.Handlebars.compile("<div class=\"staff-action-logs-controls\">\n    <a {{action clearAllFilters}} {{bindAttr class=\":clear-filters :filter filtersExists::invisible\"}}>\n      <span class=\"label\">{{i18n admin.logs.staff_actions.clear_filters}}</span>\n    </a>\n    {{#if actionFilter}}\n      <a {{action clearFilter \"action_name\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.action}}</span>: {{actionFilter}}\n        <i class=\"icon icon-remove-sign\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.acting_user}}\n      <a {{action clearFilter \"acting_user\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.staff_user}}</span>: {{filters.acting_user}}\n        <i class=\"icon icon-remove-sign\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.target_user}}\n      <a {{action clearFilter \"target_user\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.target_user}}</span>: {{filters.target_user}}\n        <i class=\"icon icon-remove-sign\"></i>\n      </a>\n    {{/if}}\n    {{#if filters.subject}}\n      <a {{action clearFilter \"subject\"}} class=\"filter\">\n        <span class=\"label\">{{i18n admin.logs.staff_actions.subject}}</span>: {{filters.subject}}\n        <i class=\"icon icon-remove-sign\"></i>\n      </a>\n    {{/if}}\n  </div>\n  \n  <div class=\"staff-action-logs-instructions\" {{bindAttr class=\":staff-action-logs-instructions showInstructions::invisible\"}}>\n    {{i18n admin.logs.staff_actions.instructions}}\n  </div>\n  \n  <div class='table staff-actions'>\n    <div class=\"heading-container\">\n      <div class=\"col heading first staff_user\">{{i18n admin.logs.staff_actions.staff_user}}</div>\n      <div class=\"col heading action\">{{i18n admin.logs.action}}</div>\n      <div class=\"col heading subject\">{{i18n admin.logs.staff_actions.subject}}</div>\n      <div class=\"col heading created_at\">{{i18n admin.logs.staff_actions.when}}</div>\n      <div class=\"col heading details\">{{i18n admin.logs.staff_actions.details}}</div>\n      <div class=\"col heading context\">{{i18n admin.logs.staff_actions.context}}</div>\n      <div class=\"clearfix\"></div>\n    </div>\n  \n    {{#if loading}}\n      <br/>\n      <div class='admin-loading'>{{i18n loading}}</div>\n    {{else}}\n      {{#if model.length}}\n        {{view Discourse.StaffActionLogsListView contentBinding=\"controller\"}}\n      {{else}}\n        {{i18n search.no_results}}\n      {{/if}}\n    {{/if}}\n  </div>");
Ember.TEMPLATES["admin/templates/logs/staff_action_logs_list_item"] = Ember.Handlebars.compile("<div class=\"col value first staff_user\">\n    {{#link-to 'adminUser' acting_user}}{{avatar acting_user imageSize=\"tiny\"}}{{/link-to}}\n    <a {{action filterByStaffUser acting_user}} class=\"btn btn-small\">{{acting_user.username}}</a>\n  </div>\n  <div class=\"col value action\">\n    <a {{action filterByAction action_name}} class=\"btn btn-small\">{{actionName}}</a>\n  </div>\n  <div class=\"col value subject\">\n    {{#if target_user}}\n      {{#link-to 'adminUser' target_user}}{{avatar target_user imageSize=\"tiny\"}}{{/link-to}}\n      <a {{action filterByTargetUser target_user}} class=\"btn btn-small\">{{target_user.username}}</a>\n    {{/if}}\n    {{#if subject}}\n      <a {{action filterBySubject subject}} {{bindAttr title=\"subject\"}}  class=\"btn btn-small\">{{subject}}</a>\n    {{/if}}\n  </div>\n  <div class=\"col value created_at\">{{unboundAgeWithTooltip created_at}}</div>\n  <div class=\"col value details\">\n    {{{formattedDetails}}}\n    {{#if useCustomModalForDetails}}\n      <a {{action showCustomDetailsModal this}}>{{i18n admin.logs.staff_actions.show}}</a>\n    {{/if}}\n    {{#if useModalForDetails}}\n      <a {{action showDetailsModal this}}>{{i18n admin.logs.staff_actions.show}}</a>\n    {{/if}}\n  </div>\n  <div class=\"col value context\">{{context}}</div>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/modal/admin_suspend_user"] = Ember.Handlebars.compile("<div class=\"modal-body\">\n    <form>\n      {{i18n admin.user.suspend_duration}}\n      {{textField value=duration maxlength=\"5\" autofocus=\"autofocus\" class=\"span2\"}}\n      {{i18n admin.user.suspend_duration_units}}<br/>\n      <br/>\n      {{{i18n admin.user.suspend_reason_label}}}<br/>\n      <br/>\n      {{textField value=reason class=\"span8\"}}\n    </form>\n  </div>\n  <div class=\"modal-footer\">\n    <button class='btn btn-danger' {{action suspend}}><i class='icon icon-ban-circle'></i>{{i18n admin.user.suspend}}</button>\n    <a {{action closeModal}}>{{i18n cancel}}</a>\n  </div>");
Ember.TEMPLATES["admin/templates/reports"] = Ember.Handlebars.compile("{{#if loaded}}\n    <h3>{{title}}</h3>\n  \n    <button class='btn'\n            {{action viewAsTable}}\n            {{bindAttr disabled=\"viewingTable\"}}>{{i18n admin.dashboard.reports.view_table}}</button>\n  \n    <button class='btn'\n            {{action viewAsBarChart}}\n            {{bindAttr disabled=\"viewingBarChart\"}}>{{i18n admin.dashboard.reports.view_chart}}</button>\n  \n    <table class='table report'>\n      <tr>\n        <th>{{xaxis}}</th>\n        <th>{{yaxis}}</th>\n      </tr>\n  \n      {{#each row in data}}\n        <tr>\n          <td>{{row.x}}</td>\n          <td>\n            {{#if viewingTable}}\n              {{row.y}}\n            {{/if}}\n            {{#if viewingBarChart}}\n              <div class='bar-container'>\n                <div class='bar' style=\"width: {{unbound row.percentage}}%\">{{row.y}}</div>\n              </div>\n            {{/if}}\n          </td>\n        </tr>\n      {{/each}}\n    </table>\n  \n  {{else}}\n    {{i18n loading}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/reports/per_day_counts_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\"><a {{bindAttr href=\"reportUrl\"}}>{{title}}</a></td>\n    <td class=\"value\">{{todayCount}}</td>\n    <td class=\"value\">{{yesterdayCount}}</td>\n    <td class=\"value\">{{sevenDaysAgoCount}}</td>\n    <td class=\"value\">{{thirtyDaysAgoCount}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/reports/summed_counts_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\">\n      {{#if icon}}\n        <i {{bindAttr class=\":icon icon\"}}></i>\n      {{/if}}\n      <a {{bindAttr href=\"reportUrl\"}}>{{title}}</a>\n    </td>\n    <td class=\"value\">{{todayCount}}</td>\n    <td {{bindAttr class=\":value yesterdayTrend\"}} {{bindAttr title=\"yesterdayCountTitle\"}}>{{yesterdayCount}} <i class=\"icon up icon-caret-up\"></i><i class=\"icon down icon-caret-down\"></i></td>\n    <td {{bindAttr class=\":value sevenDayTrend\"}} {{bindAttr title=\"sevenDayCountTitle\"}}>{{lastSevenDaysCount}} <i class=\"icon up icon-caret-up\"></i><i class=\"icon down icon-caret-down\"></i></td>\n    <td {{bindAttr class=\":value thirtyDayTrend\"}} {{bindAttr title=\"thirtyDayCountTitle\"}}>{{lastThirtyDaysCount}} <i class=\"icon up icon-caret-up\"></i><i class=\"icon down icon-caret-down\"></i></td>\n    <td class=\"value\">{{total}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/reports/trust_levels_report"] = Ember.Handlebars.compile("<tr>\n    <td class=\"title\">{{title}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.newuser'}}{{valueAtTrustLevel data 0}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.basic'}}{{valueAtTrustLevel data 1}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.regular'}}{{valueAtTrustLevel data 2}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.leaders'}}{{valueAtTrustLevel data 3}}{{/link-to}}</td>\n    <td class=\"value\">{{#link-to 'adminUsersList.elders'}}{{valueAtTrustLevel data 4}}{{/link-to}}</td>\n  </tr>");
Ember.TEMPLATES["admin/templates/site_content_edit"] = Ember.Handlebars.compile("<h3>{{model.title}}</h3>\n    <p class='description'>{{model.description}}</p>\n  \n    {{#if model.markdown}}\n      {{pagedown value=model.content}}\n    {{/if}}\n  \n    {{#if model.plainText}}\n      {{textarea value=model.content class=\"plain\"}}\n    {{/if}}\n  \n    {{#if model.html}}\n      {{aceEditor content=model.content mode=\"html\"}}\n    {{/if}}\n  \n    {{#if model.css}}\n      {{aceEditor content=model.content mode=\"css\"}}\n    {{/if}}\n  \n  \n  \n    <div class='controls'>\n      <button class='btn' {{action saveChanges}} {{bindAttr disabled=\"saveDisabled\"}}>\n        {{#if saving}}\n          {{i18n saving}}\n        {{else}}\n          {{i18n save}}\n        {{/if}}\n      </button>\n      {{#if saved}}{{i18n saved}}{{/if}}\n    </div>");
Ember.TEMPLATES["admin/templates/site_contents"] = Ember.Handlebars.compile("<div class='row'>\n    <div class='content-list span6'>\n      <h3>{{i18n admin.site_content.edit}}</h3>\n      <ul>\n        {{#each type in model}}\n          <li>\n            {{#link-to 'adminSiteContentEdit' type}}{{type.title}}{{/link-to}}\n          </li>\n        {{/each}}\n      </ul>\n    </div>\n  \n    <div class='content-editor'>\n      {{outlet}}\n    </div>\n  </div>");
Ember.TEMPLATES["admin/templates/site_contents_empty"] = Ember.Handlebars.compile("<p>{{i18n admin.site_content.none}}</p>");
Ember.TEMPLATES["admin/templates/site_settings"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='search controls'>\n      <label>\n        {{input type=\"checkbox\" checked=onlyOverridden}}\n        {{i18n admin.site_settings.show_overriden}}\n      </label>\n    </div>\n    <div class='controls'>\n      {{textField value=filter placeholderKey=\"type_to_filter\"}}\n    </div>\n  </div>\n  \n  <div class=\"site-settings-nav pull-left\">\n    <ul class=\"nav nav-stacked\">\n      {{#each category in controller}}\n        <li {{bindAttr class=\"category.nameKey\"}}>\n          {{#link-to 'adminSiteSettingsCategory' category.nameKey class=category.nameKey}}\n            {{category.name}}\n            {{#if filtered}}\n              <span class=\"count\">({{category.siteSettings.length}})</span>\n            {{/if}}\n            <span class='icon-chevron-right'></span>\n          {{/link-to}}\n        </li>\n      {{/each}}\n    </ul>\n  </div>\n  \n  <div class=\"site-settings-detail pull-left\">\n    {{ outlet }}\n  </div>\n  \n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/site_settings/setting_bool"] = Ember.Handlebars.compile("<div class='setting-label'>\n    <h3>{{unbound setting}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    <label>\n      {{view Ember.Checkbox checkedBinding=\"enabled\" value=\"true\"}}\n      {{unbound description}}\n    </label>\n  </div>");
Ember.TEMPLATES["admin/templates/site_settings/setting_enum"] = Ember.Handlebars.compile("<div class='setting-label'>\n     <h3>{{unbound setting}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    {{combobox valueAttribute=\"value\" content=validValues value=value none=allowsNone}}\n    <div class='desc'>{{unbound description}}</div>\n  </div>\n  {{#if dirty}}\n    <div class='setting-controls'>\n      <button class='btn ok' {{action save this}}><i class='icon-ok'></i></button>\n      <button class='btn cancel' {{action cancel this}}><i class='icon-remove'></i></button>\n    </div>\n  {{else}}\n    {{#if overridden}}\n      <button class='btn' href='#' {{action resetDefault this}}>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings/setting_string"] = Ember.Handlebars.compile("<div class='setting-label'>\n     <h3>{{unbound setting}}</h3>\n  </div>\n  <div class=\"setting-value\">\n    {{textField value=value classNames=\"input-setting-string\"}}\n    <div class='desc'>{{unbound description}}</div>\n  </div>\n  {{#if dirty}}\n    <div class='setting-controls'>\n      <button class='btn ok' {{action save this}}><i class='icon-ok'></i></button>\n      <button class='btn cancel' {{action cancel this}}><i class='icon-remove'></i></button>\n    </div>\n  {{else}}\n    {{#if overridden}}\n      <button class='btn' href='#' {{action resetDefault this}}>{{i18n admin.site_settings.reset}}</button>\n    {{/if}}\n  {{/if}}");
Ember.TEMPLATES["admin/templates/site_settings_category"] = Ember.Handlebars.compile("<h2>{{name}}</h2>\n  <hr/>\n  \n  {{collection contentBinding=\"filteredContent\" classNames=\"form-horizontal settings\" itemViewClass=\"Discourse.SiteSettingView\"}}");
Ember.TEMPLATES["admin/templates/user"] = Ember.Handlebars.compile("<section class='details'>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.username.title}}</div>\n      <div class='value'>{{username}}</div>\n      <div class='controls'>\n        {{#link-to 'userActivity' model class=\"btn\"}}\n          <i class='icon icon-user'></i>\n          {{i18n admin.user.show_public_profile}}\n        {{/link-to}}\n        {{#if can_impersonate}}\n            <button class='btn' {{action impersonate target=\"content\"}}>\n              <i class='icon icon-screenshot'></i>\n              {{i18n admin.user.impersonate}}\n            </button>\n        {{/if}}\n      </div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.email.title}}</div>\n      <div class='value'><a href=\"mailto:{{unbound email}}\">{{email}}</a></div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.avatar.title}}</div>\n      <div class='value'>{{avatar content imageSize=\"large\"}}</div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.title.title}}</div>\n      <div class='value'>\n        {{#if editingTitle}}\n          {{textField value=title autofocus=\"autofocus\"}}\n        {{else}}\n          <span {{action toggleTitleEdit}}>{{title}}&nbsp;</span>\n        {{/if}}\n      </div>\n      <div class='controls'>\n        {{#if editingTitle}}\n          <button class='btn' {{action saveTitle}}>{{i18n admin.user.save_title}}</button>\n          <a href=\"#\" {{action toggleTitleEdit}}>{{i18n cancel}}</a>\n        {{else}}\n          <button class='btn' {{action toggleTitleEdit}}>{{i18n admin.user.edit_title}}</button>\n        {{/if}}\n      </div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n user.ip_address.title}}</div>\n      <div class='value'>{{ip_address}}</div>\n      <div class='controls'>\n        {{#if currentUser.admin}}\n        <button class='btn' {{action refreshBrowsers target=\"content\"}}>\n          {{i18n admin.user.refresh_browsers}}\n        </button>\n        {{/if}}\n      </div>\n    </div>\n  \n  </section>\n  \n  \n  <section class='details'>\n    <h1>{{i18n admin.user.permissions}}</h1>\n  \n    {{#if showApproval}}\n      <div class='display-row'>\n        <div class='field'>{{i18n admin.users.approved}}</div>\n        <div class='value'>\n          {{#if approved}}\n            {{i18n admin.user.approved_by}}\n  \n            {{#link-to 'adminUser' approved_by}}{{avatar approved_by imageSize=\"small\"}}{{/link-to}}\n            {{#link-to 'adminUser' approved_by}}{{approved_by.username}}{{/link-to}}\n          {{else}}\n            {{i18n no_value}}\n          {{/if}}\n  \n        </div>\n        <div class='controls'>\n          {{#if approved}}\n            {{i18n admin.user.approve_success}}\n          {{else}}\n            {{#if can_approve}}\n              <button class='btn' {{action approve target=\"content\"}}>\n                <i class='icon icon-ok'></i>\n                {{i18n admin.user.approve}}\n              </button>\n            {{/if}}\n          {{/if}}\n        </div>\n      </div>\n    {{/if}}\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.users.active}}</div>\n      <div class='value'>\n        {{#if active}}\n          {{i18n yes_value}}\n        {{else}}\n          {{i18n no_value}}\n        {{/if}}\n      </div>\n      <div class='controls'>\n        {{#if active}}\n          {{#if can_deactivate}}\n            <button class='btn' {{action deactivate target=\"content\"}}>{{i18n admin.user.deactivate_account}}</button>\n            {{i18n admin.user.deactivate_explanation}}\n          {{/if}}\n        {{else}}\n          {{#if can_send_activation_email}}\n            <button class='btn' {{action sendActivationEmail target=\"content\"}}>\n              <i class='icon icon-envelope'></i>\n              {{i18n admin.user.send_activation_email}}\n            </button>\n          {{/if}}\n          {{#if can_activate}}\n            <button class='btn' {{action activate target=\"content\"}}>\n              <i class='icon icon-ok'></i>\n              {{i18n admin.user.activate}}\n            </button>\n          {{/if}}\n        {{/if}}\n      </div>\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.api.key}}</div>\n  \n      {{#if api_key}}\n        <div class='long-value'>\n          {{api_key.key}}\n          <button class='btn' {{action regenerateApiKey}}>{{i18n admin.api.regenerate}}</button>\n          <button {{action revokeApiKey}} class=\"btn\">{{i18n admin.api.revoke}}</button>\n        </div>\n      {{else}}\n        <div class='value'>\n        &mdash;\n        </div>\n        <div class='controls'>\n          <button {{action generateApiKey}} class=\"btn\">{{i18n admin.api.generate}}</button>\n        </div>\n      {{/if}}\n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.admin}}</div>\n      <div class='value'>{{admin}}</div>\n      <div class='controls'>\n        {{#if can_revoke_admin}}\n          <button class='btn' {{action revokeAdmin target=\"content\"}}>\n            <i class='icon icon-trophy'></i>\n            {{i18n admin.user.revoke_admin}}\n          </button>\n        {{/if}}\n        {{#if can_grant_admin}}\n          <button class='btn' {{action grantAdmin target=\"content\"}}>\n            <i class='icon icon-trophy'></i>\n            {{i18n admin.user.grant_admin}}\n          </button>\n        {{/if}}\n      </div>\n  \n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.moderator}}</div>\n      <div class='value'>{{moderator}}</div>\n      <div class='controls'>\n        {{#if can_revoke_moderation}}\n          <button class='btn' {{action revokeModeration target=\"content\"}}>\n            <i class='icon icon-magic'></i>\n            {{i18n admin.user.revoke_moderation}}\n          </button>\n        {{/if}}\n        {{#if can_grant_moderation}}\n          <button class='btn' {{action grantModeration target=\"content\"}}>\n            <i class='icon icon-magic'></i>\n            {{i18n admin.user.grant_moderation}}\n          </button>\n        {{/if}}\n      </div>\n  \n    </div>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n trust_level}}</div>\n      <div class=\"value\">\n        {{combobox content=trustLevels value=trust_level nameProperty=\"detailedName\"}}\n      </div>\n      <div class=\"controls\">\n      {{#if dirty}}\n        <div>\n        <button class='btn ok' {{action saveTrustLevel target=\"content\"}}><i class='icon-ok'></i></button>\n        <button class='btn cancel' {{action restoreTrustLevel target=\"content\"}}><i class='icon-remove'></i></button>\n        </div>\n      {{/if}}\n      </div>\n    </div>\n  \n    <div {{bindAttr class=\":display-row isSuspended:highlight-danger\"}}>\n      <div class='field'>{{i18n admin.user.suspended}}</div>\n      <div class='value'>{{isSuspended}}</div>\n      <div class='controls'>\n      {{#if isSuspended}}\n        <button class='btn btn-danger' {{action unsuspend target=\"content\"}}>\n          <i class='icon icon-ban-circle'></i>\n          {{i18n admin.user.unsuspend}}\n        </button>\n        {{suspendDuration}}\n        {{i18n admin.user.suspended_explanation}}\n      {{else}}\n        {{#if canSuspend}}\n          <button class='btn btn-danger' {{action showSuspendModal this}}>\n            <i class='icon icon-ban-circle'></i>\n            {{i18n admin.user.suspend}}\n          </button>\n          {{i18n admin.user.suspended_explanation}}\n        {{/if}}\n      {{/if}}\n      </div>\n    </div>\n  \n    {{#if isSuspended}}\n    <div class='display-row highlight-danger'>\n      <div class='field'>{{i18n admin.user.suspended_by}}</div>\n      <div class='value'>\n        {{#link-to 'adminUser' suspended_by}}{{avatar suspended_by imageSize=\"tiny\"}}{{/link-to}}\n        {{#link-to 'adminUser' suspended_by}}{{suspended_by.username}}{{/link-to}}\n      </div>\n      <div class='controls'>\n        <b>{{i18n admin.user.suspend_reason}}</b>:\n        {{suspend_reason}}\n      </div>\n    </div>\n    {{/if}}\n  \n    <div class='display-row' {{bindAttr class=\":display-row blocked:highlight-danger\"}}>\n      <div class='field'>{{i18n admin.user.blocked}}</div>\n      <div class='value'>{{blocked}}</div>\n      <div class='controls'>\n        {{#if blocked}}\n          <button class='btn' {{action unblock target=\"content\"}}>\n            <i class='icon icon-thumbs-up'></i>\n            {{i18n admin.user.unblock}}\n          </button>\n          {{i18n admin.user.block_explanation}}\n        {{/if}}\n      </div>\n    </div>\n  </section>\n  \n  <section class='details'>\n    <h1>{{i18n admin.user.activity}}</h1>\n  \n    <div class='display-row'>\n      <div class='field'>{{i18n created}}</div>\n      <div class='value'>{{{created_at_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.users.last_emailed}}</div>\n      <div class='value'>{{{last_emailed_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n last_seen}}</div>\n      <div class='value'>{{{last_seen_age}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.like_count}}</div>\n      <div class='value'>{{like_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.topics_entered}}</div>\n      <div class='value'>{{topics_entered}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.post_count}}</div>\n      <div class='value'>{{post_count}}</div>\n      <div class='controls'>\n        {{#if can_delete_all_posts}}\n          <button class='btn btn-danger' {{action deleteAllPosts target=\"content\"}}>\n            <i class='icon icon-trash'></i>\n            {{i18n admin.user.delete_all_posts}}\n          </button>\n        {{/if}}\n      </div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.posts_read_count}}</div>\n      <div class='value'>{{posts_read_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.flags_given_count}}</div>\n      <div class='value'>{{flags_given_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.flags_received_count}}</div>\n      <div class='value'>{{flags_received_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.private_topics_count}}</div>\n      <div class='value'>{{private_topics_count}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n admin.user.time_read}}</div>\n      <div class='value'>{{{time_read}}}</div>\n    </div>\n    <div class='display-row'>\n      <div class='field'>{{i18n user.invited.days_visited}}</div>\n      <div class='value'>{{{days_visited}}}</div>\n    </div>\n  </section>\n  \n  <section>\n    <hr/>\n    <button class=\"btn btn-danger pull-right\" {{action destroy target=\"content\"}} {{bindAttr disabled=\"deleteForbidden\"}} {{bindAttr title=\"deleteButtonTitle\"}}>\n      <i class=\"icon icon-warning-sign\"></i>\n      {{i18n admin.user.delete}}\n    </button>\n  </section>\n  <div class=\"clearfix\"></div>");
Ember.TEMPLATES["admin/templates/users_list"] = Ember.Handlebars.compile("<div class='admin-controls'>\n    <div class='span15'>\n      <ul class=\"nav nav-pills\">\n        <li>{{#link-to 'adminUsersList.active'}}{{i18n admin.users.nav.active}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.new'}}{{i18n admin.users.nav.new}}{{/link-to}}</li>\n        {{#if Discourse.SiteSettings.must_approve_users}}\n          <li>{{#link-to 'adminUsersList.pending'}}{{i18n admin.users.nav.pending}}{{/link-to}}</li>\n        {{/if}}\n        <li>{{#link-to 'adminUsersList.admins'}}{{i18n admin.users.nav.admins}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.moderators'}}{{i18n admin.users.nav.moderators}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.suspended'}}{{i18n admin.users.nav.suspended}}{{/link-to}}</li>\n        <li>{{#link-to 'adminUsersList.blocked'}}{{i18n admin.users.nav.blocked}}{{/link-to}}</li>\n      </ul>\n    </div>\n    <div class='span5 username controls'>\n      {{textField value=username placeholderKey=\"username\"}}\n    </div>\n  </div>\n  \n  {{#if hasSelection}}\n    <div id='selected-controls'>\n      <button {{action approveUsers}} class='btn'>{{countI18n admin.users.approved_selected countBinding=\"selectedCount\"}}</button>\n      <button {{action rejectUsers}}  class='btn btn-danger'>{{countI18n admin.users.reject_selected countBinding=\"selectedCount\"}}</button>\n    </div>\n  {{/if}}\n  \n  <h2>{{title}}</h2>\n  <br/>\n  \n  {{#if loading}}\n    <div class='admin-loading'>{{i18n loading}}</div>\n  {{else}}\n    {{#if model.length}}\n      <table class='table'>\n        <tr>\n          {{#if showApproval}}\n            <th>{{view Ember.Checkbox checkedBinding=\"selectAll\"}}</th>\n          {{/if}}\n          <th>&nbsp;</th>\n          <th>{{i18n username}}</th>\n          <th>{{i18n email}}</th>\n          <th>{{i18n admin.users.last_emailed}}</th>\n          <th>{{i18n last_seen}}</th>\n          <th>{{i18n admin.user.topics_entered}}</th>\n          <th>{{i18n admin.user.posts_read_count}}</th>\n          <th>{{i18n admin.user.time_read}}</th>\n          <th>{{i18n created}}</th>\n          {{#if showApproval}}\n            <th>{{i18n admin.users.approved}}</th>\n          {{/if}}\n          <th>&nbsp;</th>\n  \n        </tr>\n  \n        {{#each model}}\n          <tr {{bindAttr class=\"selected\"}}>\n            {{#if controller.showApproval}}\n              <td>\n                {{#if can_approve}}\n                  {{view Ember.Checkbox checkedBinding=\"selected\"}}\n                {{/if}}\n              </td>\n            {{/if}}\n            <td>{{#link-to 'adminUser' this}}{{avatar this imageSize=\"small\"}}{{/link-to}}</td>\n            <td>{{#link-to 'adminUser' this}}{{unbound username}}{{/link-to}}</td>\n            <td>{{shorten email}}</td>\n            <td>{{{unbound last_emailed_age}}}</td>\n            <td>{{{unbound last_seen_age}}}</td>\n            <td>{{{unbound topics_entered}}}</td>\n            <td>{{{unbound posts_read_count}}}</td>\n            <td>{{{unbound time_read}}}</td>\n  \n            <td>{{{unbound created_at_age}}}</td>\n  \n            {{#if showApproval}}\n            <td>\n              {{#if approved}}\n                {{i18n yes_value}}\n              {{else}}\n                {{i18n no_value}}\n              {{/if}}\n            </td>\n            {{/if}}\n            <td>\n              {{#if admin}}<i class=\"icon-trophy\" title=\"{{i18n admin.title}}\"></i>{{/if}}\n              {{#if moderator}}<i class=\"icon-magic\" title=\"{{i18n admin.moderator}}\"></i>{{/if}}\n            <td>\n          </tr>\n        {{/each}}\n  \n      </table>\n    {{else}}\n      <p>{{i18n search.no_results}}</p>\n    {{/if}}\n  {{/if}}");
(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/*global ace:true */

/**
  A view that wraps the ACE editor (http://ace.ajax.org/)

  @class AceEditorView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AceEditorView = Discourse.View.extend({
  mode: 'css',
  classNames: ['ace-wrapper'],

  contentChanged: (function() {
    if (this.editor && !this.skipContentChangeEvent) {
      return this.editor.getSession().setValue(this.get('content'));
    }
  }).observes('content'),

  render: function(buffer) {
    buffer.push("<div class='ace'>");
    if (this.get('content')) {
      buffer.push(Handlebars.Utils.escapeExpression(this.get('content')));
    }
    return buffer.push("</div>");
  },

  willDestroyElement: function() {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  },

  didInsertElement: function() {

    var aceEditorView = this;

    var initAce = function() {
      aceEditorView.editor = ace.edit(aceEditorView.$('.ace')[0]);
      aceEditorView.editor.setTheme("ace/theme/chrome");
      aceEditorView.editor.setShowPrintMargin(false);
      aceEditorView.editor.getSession().setMode("ace/mode/" + (aceEditorView.get('mode')));
      aceEditorView.editor.on("change", function(e) {
        aceEditorView.skipContentChangeEvent = true;
        aceEditorView.set('content', aceEditorView.editor.getSession().getValue());
        aceEditorView.skipContentChangeEvent = false;
      });
    };

    if (window.ace) {
      initAce();
    } else {
      $LAB.script('/javascripts/ace/ace.js').wait(initAce);
    }
  }
});


Discourse.View.registerHelper('aceEditor', Discourse.AceEditorView);


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminApiView = Discourse.View.extend({
  templateName: 'admin/templates/api'
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/*global Mousetrap:true */

/**
  A view to handle site customizations

  @class AdminCustomizeView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminCustomizeView = Discourse.View.extend({
  templateName: 'admin/templates/customize',
  classNames: ['customize'],
  headerActive: Ember.computed.equal('selected', 'header'),
  stylesheetActive: Ember.computed.equal('selected', 'stylesheet'),
  mobileHeaderActive: Ember.computed.equal('selected', 'mobileHeader'),
  mobileStylesheetActive: Ember.computed.equal('selected', 'mobileStylesheet'),

  init: function() {
    this._super();
    this.set('selected', 'stylesheet');
  },

  selectHeader: function() {
    this.set('selected', 'header');
  },

  selectStylesheet: function() {
    this.set('selected', 'stylesheet');
  },

  selectMobileHeader: function() {
    this.set('selected', 'mobileHeader');
  },

  selectMobileStylesheet: function() {
    this.set('selected', 'mobileStylesheet');
  },

  didInsertElement: function() {
    var controller = this.get('controller');
    return Mousetrap.bindGlobal(['meta+s', 'ctrl+s'], function() {
      controller.save();
      return false;
    });
  },

  willDestroyElement: function() {
    return Mousetrap.unbindGlobal('meta+s', 'ctrl+s');
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  The default view in the admin section

  @class AdminDashboardView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminDashboardView = Discourse.View.extend({
  templateName: 'admin/templates/dashboard'
});




// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminFlagsView = Discourse.View.extend(Discourse.LoadMore, {
  loading: false,
  eyelineSelector: '.admin-flags tbody tr',
  loadMore: function() {
    var view = this;
    if(this.get("loading") || this.get("model.allLoaded")) { return; }
    this.set("loading", true);
    this.get("controller").loadMore().then(function(){
      view.set("loading", false);
    });
  }

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminSiteSettingsCategoryView = Discourse.View.extend({
  templateName: 'admin/templates/site_settings_category'
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedEmailsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_emails_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedIpAddressesListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_ip_addresses_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.ScreenedUrlsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 32,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/screened_urls_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.StaffActionLogsListView = Ember.ListView.extend({
  height: 700,
  rowHeight: 75,
  itemViewClass: Ember.ListItemView.extend({templateName: "admin/templates/logs/staff_action_logs_list_item"})
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal.

  @class AdminStaffActionLogDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminStaffActionLogDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/details_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for suspending a user.

  @class AdminSuspendUserView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.AdminSuspendUserView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/modal/admin_suspend_user',
  title: I18n.t('admin.user.suspend_modal_title')
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal
  for when a site customization is created or changed.

  @class ChangeSiteCustomizationDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.ChangeSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/site_customization_change_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A modal view for details of a staff action log record in a modal
  for when a site customization is deleted.

  @class DeleteSiteCustomizationDetailsView
  @extends Discourse.ModalBodyView
  @namespace Discourse
  @module Discourse
**/

Discourse.DeleteSiteCustomizationDetailsView = Discourse.ModalBodyView.extend({
  templateName: 'admin/templates/logs/site_customization_change_modal',
  title: I18n.t('admin.logs.staff_actions.modal_title')
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

Discourse.AdminReportCountsView = Discourse.View.extend({
  templateName: 'admin/templates/reports/summed_counts_report',
  tagName: 'tbody'
});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:

/**
  A view to display a site setting with edit controls

  @class SiteSettingView
  @extends Discourse.View
  @namespace Discourse
  @module Discourse
**/

Discourse.SiteSettingView = Discourse.View.extend({
  classNameBindings: [':row', ':setting', 'content.overridden'],

  templateName: function() {

    // If we're editing a boolean, return a different template
    if (this.get('content.type') === 'bool') return 'admin/templates/site_settings/setting_bool';

    // If we're editing an enum field, show a dropdown
    if (this.get('content.type') === 'enum' ) return 'admin/templates/site_settings/setting_enum';

    // Default to string editor
    return 'admin/templates/site_settings/setting_string';

  }.property('content.type')

});


// IIFE Wrapped Content Ends

 })(this);(function () {

var $ = window.jQuery;
// IIFE Wrapped Content Begins:




// IIFE Wrapped Content Ends

 })(this);