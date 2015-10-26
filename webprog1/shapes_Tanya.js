// Constructor for shape objects.
function Shape (x, y, w, h, fill) {

  this.x = x || 0;
  this.y = y || 0;
  this.w = w || 1;
  this.h = h || 1;
  this.fill = fill || '#AAAAA';
}

// Draw shape to current context
Shape.prototype.draw = function(ctx) {
  ctx.fillStyle = this.fill;
  ctx.fillRect(this.x, this.y, this.w, this.h);
}

// Determine if a point is inside the shape's bounds
Shape.prototype.contains = function(mx, my) {
  // All we have to do is make sure the Mouse X,Y fall in the area between
  // the shape's X and (X + Width) and its Y and (Y + Height)
  return  (this.x <= mx) && (this.x + this.w >= mx) &&
          (this.y <= my) && (this.y + this.h >= my);
}
// Set up a canvas
function CanvasState(canvas) {
  this.canvas = canvas;
  this.width = canvas.width;
  this.height = canvas.height;
  this.ctx = canvas.getContext('2d');

  var stylePaddingleft, stylePaddingTop, styleBorderLeft, styleBorderTop;
  if(document.defaultView && document.defaultView.getComputedStyle) {
  this.stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10)      || 0;
  this.stylePaddingTop  = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10)       || 0;
  this.styleBorderLeft  = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10)  || 0;
  this.styleBorderTop   = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10)   || 0;
  }

// Each shape and shape size is a different state so we must keep track of a state.
  this.valid = false; // when false, canvas redraws everything
  this.shapes = []; //keeps collection of things to be drawn. Should be 1 in my (Tanya's) case
  this.dragging = false; // Keep track of when we are dragging
  // selection, dragoffx and dragoffy refer to the currently selected object:
  this.selection = null;
  this.dragoffx = 0; // refers to mousedown and mousemove events
  this.dragoffy = 0;

// Now keep track of events
  var myState = this;

  canvas.addEventListener('selectstart', function(e) {e.preventDefault(); return false; }, false); // fix problem where double-clicking causes text to get highlighted on canvas
  // up, down, move are for dragging
  canvas.addEventListener('mousedown', function(e) {
    var mouse = myState.getMouse(e);
    var mx = mouse.x;
    var my = mouse.y;
    var shapes = myState.shapes;
    var l = shapes.length;
    for (var i = l-1; i >= 0; i--) {
      if (shapes[i].contains(mx, my)) {
        var mySel = shapes[i];
        // Keep track of where in the object we clicked
        // so we can move it smoothly (see mousemove)
        myState.dragoffx = mx - mySel.x;
        myState.dragoffy = my - mySel.y;
        myState.dragging = true;
        myState.selection = mySel;
        myState.valid = false;
        return;
      }
    }

    // haven't returned means user did not select anything.
    // If there was an object selected, it gets deselected
    if (myState.selection) {
      myState.selection = null;
      myState.valid = false; // Clear old selection border
    }
  }, true);
  canvas.addEventListener('mousemove', function(e) {
    if(myState.dragging) {
      var mouse = myState.getMouse(e);
      // Want to drag object by wherever we click, not the top-left corner.
      // So we use the saved offset and use that here.
      myState.selection.x = mouse.x - myState.dragoffx;
      myState.selection.y = mouse.y - myState.dragoffy;
      myState.valid = false; // Something is dragging so user must redraw
    }
  }, true);
  canvas.addEventListener('mouseup', function(e) {
    myState.dragging = false;
  }, true);
  // double click to make a new shape
  canvas.addEventListener('dbclick', function(e) {
    var mouse = myState.getMouse(e);
    myState.addShape(new Shape(mouse.x - 10, mouse.y - 10, 20, 20, 'rgba(0,255,0,.6)'));
  }, true);

  // Options for color, etc.

  this.selectionColor = '#CC0000';
  this.selectionWidth = 2;
  this.interval = 30;
  setInterval(function() {myState.draw(); }, myState.interval);
  }

CanvasState.prototype.addShape = function(shape) {
  this.shapes.push(shape);
  this.valid = false
}

CanvasState.prototype.clear = function() {
  this.ctx.clearRect(0, 0, this.width, this.height);
}

// While draw is called as often as the interval variable demands,
// it only does something if canvas gets invalidated by the code
CanvasState.prototype.draw = function() {
  // if state is invalid, redraw and validate
  if (!this.valid) {
    var ctx = this.ctx;
    var shapes = this.shapes;
    this.clear();

    // ** Put the background image here! **


    // draw all shapes
    var l = shapes.length;
    for (var i = 0; i < l; i++) {
      var shape = shapes[i];
      // Skip drawing of elements that have moved off screen:
      if (shape.x > this.width || shape.y > this.height ||
        shape.x + shape.w < 0 || shape.y + shape.h < 0) continue;
        shapes[i].draw(ctx);
    }

    // draw selection
    // this is just a stroke along edge of selected rectangle
    if (this.selection != null) {
      ctx.strokeStyle = this.selectionColor;
      ctx.lineWidth = this.selectionWidth;
      var mySel = this.selection;
      ctx.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
    }
  // ** Add anything you want drawn on top all the time here **

  this.valid = true;
  }
}

// Create object with x and y defined, set to mouse position relative to state's canvas
// If you want to be super correct, this can be tricky because we have to worry about padding and borders
CanvasState.prototype.getMouse = function(e) {
  var element = this.canvas, offsetX = 0, offsetY = 0, mx, my;

  // Calculate total offset
  if (element.offsetParent !== undefined) {
    do {
      offsetX += element.offsetLeft;
      offsetY += element.offsetTop;
    } while ((element = element.offsetParent));
  }

  // Add padding and border style widths to offset
  // Also add <html> offsets in case there's a position:fixed bar
  offsetX += this.stylePaddingLeft + this.styleBorderLeft + this.htmlLeft;
  offsetY += this.stylePaddingTop + this.styleBorderTop + this.htmlTop;

  mx = e.pageX - offsetX;
  my = e.pageY - offsetY;

  // Return simple javascript object (hash) with x and y defined
  return {x: mx, y: my}
}

// If you dont want to use <body onLoad='init()'>
// You could uncomment this init() reference and place the script reference inside the body tag
//init();

function init() {
  var s = new CanvasState(document.getElementById('canvas1'));
  s.addShape(new Shape(40,40,50,50)); // The default is gray
  s.addShape(new Shape(60,140,40,60, 'lightskyblue'));
  // Lets make some partially transparent
  s.addShape(new Shape(80,150,60,30, 'rgba(127, 255, 212, .5)'));
  s.addShape(new Shape(125,80,30,80, 'rgba(245, 222, 179, .7)'));
}
