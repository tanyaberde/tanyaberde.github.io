// Copyright (C) 2009  Britton Leo Kerin (image_region_selector@letterboxes.org)
// See license below.
//
// What this code can do:
//
//      Draw lines on a <div> containing an <image>
//
//      Incrementally draw a polygon on an image
//
//      Detect incomplete or tangled (edge crossed) "polygons"
//
//      Get a finished polygon description, as verticies or scan lines
//
//      Augment Object with beget method as per
//      http://javascript.crockford.com/prototypal.html
//
// Examples:
//
// Assuming this HTML (or equivalent DOM generation):
//
//    <div id="image_container" style="position: relative"
//      onClick="imageClicked(event);">
//      <img id="some_image" src="some_image.png">
//      </img>
//    </div>
//
// NOTE: relative or absolute positioning *must* be used for the containing
// <div> -- other options (in particular the default 'static') don't
// provide the right so-called containing block and will result in
// displaced drawing.
//
// You can do these things:
//
// Create your own instance from the prototype.
// var my_irs = Object.beget(imageRegionSelector);
//
// Specify the <div> on which you intend to operate.
// my_irs.attach(document.getElementById("image_container"));
//
// Return DOM node to which my_irs is attached, or FALSE if my_irs.attach
// has not been called.
// my_irs.attached_to();
//
// Draw a line on the image (+x is right, +y is down) from (50, 50) to
// (100, 100) in image coordinates, at Z axis position zpos:
// var line_handle = my_irs.draw_line({'x': 50, 'y': 50},
//                                    {'x': 100, 'y': 50},
//                                    "Red",
//                                    zpos);
//
// Erase a line:
// my_irs.erase_line(line_handle);
//
// Add a point to the current path.  The first point is rendered as a
// cross, the second point results in a line, the third a triangle, etc.
// my_irs.add_path_point(x, y);
//
// Remove the last point added from the current polygon, erasing lines as
// appropriate.
// my_irs.remove_last_path_point();
//
// Set the color to use for the lines between points added with
// add_path_point (default "Chartreuse"):
// my_irs.set_path_line_color(color);
//
// Set the color to use for the cross used to mark the first point, and for
// the "virtual" line that completes the polygon (default "Red"):
// my_irs.set_path_virtual_line_color(color);
//
// Set the Z axis position to use with lines added via add_path_point
// (default 1000):
// my_irs.set_path_zpos(zpos);
//
// Return the verticies of the area in a new array (further changes to the
// area won't be reflected in the returned object).
// my_irs.area_verticies();
//
// Return false if the current path is a valid polygon (at least three
// points, no edge crossings).  Otherwise, return a true message like "Only
// 2 points defined" or "Edges cross".
// var why_not_a_poly = my_irs.path_not_a_polygon();
//
// Require ! my_irs.path_not_a_polygon().  Return an array of scan line
// descriptions, each of which is a hash with fields 'y' (y coordinate of
// line), 'x_start' (first pixel of segment), and 'x_end'
// (last pixel of segment).
// var scan_lines = my_irs.area_pixel_ranges();
//
// Translating mouse clicks into image coordinates is surprisingly
// convoluted to do in a cross-browser way, take a look at the source for
// the page http://brittonkerin.com/image_region_selector/irs_demo.html to
// see one approach.

// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the
// Free Software Foundation, Inc., 59 Temple Place - Suite 330,
// Boston, MA 02111-1307, USA.

// If we haven't already done so, add clean prototype-based instantiation,
// as per http://javascript.crockford.com/prototypal.html
if ( typeof Object.beget !== 'function' ) {
  Object.beget = function (o) {
    var F = function () {};
    F.prototype = o;
    return new F();
  }
}

// Prototype object.
var imageRegionSelector = {

  // Private stuff, modify at your peril.

  // DOM node we want to draw on.
  container_DOM_node: undefined,
  not_attached_message:
    "image DOM node not set.  Maybe you didn't call attach()?",

  // Current line number.
  line_number: 0,

  // We maintain a map from added line numbers to arrays of pixel <div> DOM
  // nodes.
  line_pixels: {},

  path_points: [],   // Points in the current path.
  path_lines: [],   // Line handles as returned by draw_line.
  old_close_line: -1,  // The automaticly added line which closes the polygon.

  // If there is only one path point defined, the user needs to get some
  // visual indication of this, for which we use a little purple cross.
  cross_lines: [],

  //  How we draw lines (by default, there are setter methods for these).
  line_color: "Chartreuse",
  virtual_line_color: "Red",
  zpos: 1000,

  // Draw a tiny cross at point.
  draw_tiny_cross: function (point) {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }
    var px = point['x'];
    var py = point['y'];
    var cty = py - 4;   // Cross top y coordinate.
    var cby = py + 5;   // Cross bottom y coordinate.
    var clx = px - 4;   // Cross left x coordinate.
    var crx = px + 5;   // Cross right x coordinate.
    this.cross_lines.push(
        this.draw_line(
          {'x': clx, 'y': py},
          {'x': crx, 'y': py},
          this.virtual_line_color,
          this.zpos));
    this.cross_lines.push(
        this.draw_line(
          {'x': px, 'y': cty},
          {'x': px, 'y': cby},
          this.virtual_line_color,
          this.zpos));
  },

  // Erast the tiny cross.
  erase_last_tiny_cross: function () {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }
    this.erase_line(this.cross_lines.pop());
    this.erase_line(this.cross_lines.pop());
  },

  // Given four points which define two line segments, return true iff the
  // segments appear to intersect at something other than a common end
  // point.
  lines_cross: function (seg_a_start, seg_a_end, seg_b_start, seg_b_end) {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }

    var p1x = seg_a_start['x'];
    var p1y = seg_a_start['y'];
    var p2x = seg_a_end['x'];
    var p2y = seg_a_end['y'];
    var p3x = seg_b_start['x'];
    var p3y = seg_b_start['y'];
    var p4x = seg_b_end['x'];
    var p4y = seg_b_end['y'];
    var denom = (p4y - p3y) * (p2x - p1x) - (p4x - p3x) * (p2y - p1y);

    // Sloppy floating point comparison tolerance (there are better ways but
    // we don't care enough).
    var tol = 0.0001;

    // If lines aren't parallel or coincient...
    if ( ! Math.abs(denom) <= tol ) {
      // ...check if they cross.
      var ua = ((p4x - p3x) * (p1y - p3y) - (p4y - p3y) * (p1x - p3x))
        / denom;
      var ub = ((p2x - p1x) * (p1y - p3y) - (p2y - p1y) * (p1x - p3x))
        / denom;
      if ( ua >= tol && ua <= 1.0 - tol && ub >= tol && ub <= 1.0 - tol ) {
        return true;
      }
    }

    return false;
  },

  // Public functions.  See the example above.

  attach: function (container_DOM_node) {
    this.container_DOM_node = container_DOM_node;
  },

  attached_to: function () {
    return this.container_DOM_node;
  },

  draw_line: function (p1, p2, color, z_index) {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }

    this.line_number++;

    var pixels = [];

    this.line_pixels[this.line_number] = pixels;

    var bla = "";
    var xl = p1['x'] - p2['x'];
    var yl = p1['y'] - p2['y'];
    var lineLength = Math.sqrt( (xl * xl) + (yl * yl) );
    for ( i = 0 ; i < lineLength ; i++ ) {
      var pixel = document.createElement('div');
      pixel.setAttribute('style',
          "position:absolute; "
          + "left:"
          + Math.round(p1['x'] + (p2['x'] - p1['x']) * i / lineLength) + "px; "
          + "top:"
          + Math.round(p1['y'] + (p2['y'] - p1['y']) * i / lineLength) + "px; "
          + "width:1px; height:1px; z-index:" + z_index + "; "
          + "background:" + color + " "
          + "");
      pixels.push(pixel);

      this.container_DOM_node.appendChild(pixel);
    }

    return this.line_number;
  },

  erase_line: function (line_handle) {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }
    var line_pixels = this.line_pixels[line_handle];
    for ( var ii = 0 ; ii < line_pixels.length ; ii++ ) {
      var pixel = line_pixels[ii];
      pixel.parentNode.removeChild(pixel);
    }
  },

  add_path_point: function (x, y) {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }

    var ppc = this.path_points.length;
    var p1, p2;
    if ( ppc === 1 ) {
      this.erase_last_tiny_cross();
    }
    if ( ppc > 0 ) {
      p1 = this.path_points[this.path_points.length - 1];
      p2 = {'x': x, 'y': y};
      if ( ppc > 1 ) {
        if ( ppc > 2 ) {
          this.erase_line(this.old_close_line);
        }
        this.old_close_line
          = this.draw_line(
              this.path_points[0],
              p2,
              this.virtual_line_color,
              this.zpos);
      }
      this.path_points.push(p2);
      ppc++;
    }
    else {
      var point = { 'x': x, 'y': y };
      this.draw_tiny_cross(point);
      this.path_points.push(point);
      return;
    }

    this.path_lines.push(this.draw_line(p1, p2, this.line_color, this.zpos));
  },

  remove_last_path_point: function () {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }

    var ppc = this.path_points.length;
    this.path_points.pop();
    if ( ppc === 1 ) {
      this.erase_last_tiny_cross();
    }
    if ( ppc === 2 ) {
      this.draw_tiny_cross(this.path_points[0]);
    }
    if ( ppc >= 2 ) {
      this.erase_line(this.path_lines.pop());
    }
    if ( ppc >= 3 ) {
      this.erase_line(this.old_close_line);
    }
    if ( ppc >= 4 ) {
      this.old_close_line
        = this.draw_line(
            this.path_points[0],
            this.path_points[ppc - 2],
            this.virtual_line_color,
            this.zpos);
    }
  },

  set_path_line_color: function (color) {
    this.line_color = color;
  },

  set_path_virtual_line_color: function (color) {
    this.virtual_line_color = color;
  },

  set_path_zpos: function (zpos) {
    this.zpos = zpos
  },

  area_verticies: function () {
    var result = [];
    var ii;
    for ( ii = 0 ; ii < this.path_points.length ; ii++ ) {
      var current_point = this.path_points[ii];
      result.push({'x': current_point['x'], 'y': current_point['y']});
    }

    return result;
  },

  path_not_a_polygon: function () {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }

    var path = this.path_points;   // Convenience alias.

    if ( path.length < 3 ) {
      return "Only " + path.length + " points defined";
    }

    for ( ii = 0 ; ii < path.length - 1 ; ii++ ) {
      var seg_a_start, seg_a_end, seg_b_start, seg_b_end;

      seg_a_start = path[ii];
      seg_a_end = path[ii + 1];

      for ( jj = ii ; jj < path.length ; jj++ ) {

        seg_b_start = path[jj];
        if ( jj === path.length - 1 ) {
          seg_b_end = path[0];
        }
        else {
          seg_b_end = path[jj + 1];
        }

        if ( this.lines_cross(
              seg_a_start, seg_a_end, seg_b_start, seg_b_end) ) {
          return "Edges cross";
        }
      }
    }

    return false;
  },

  area_pixel_ranges: function () {
    if ( ! this.container_DOM_node ) { throw(this.not_attached_message) }
    var why_not_a_poly = this.path_not_a_polygon();
    if ( why_not_a_poly ) {
      throw "Invalid polygon: " + why_not_a_poly;
    }

    var path = this.path_points;   // Convenience alias.

    var pl = path.length;

    // Determine extent of area defined by path in X and Y (find smallest
    // bounding rectangle).
    var x_min = Infinity;
    var x_max = -Infinity;
    var y_min = Infinity;
    var y_max = -Infinity;
    for ( var ii = 0 ; ii < pl ; ii++ ) {
      var point = path[ii];
      if ( point.x < x_min ) {
        x_min = point.x;
      }
      if ( point.x > x_max ) {
        x_max = point.x;
      }
      if ( point.y < y_min ) {
        y_min = point.y;
      }
      if ( point.y > y_max ) {
        y_max = point.y;
      }
    }

    // Traverse the rectangle defined by the extent of the path, and do a
    // Jordan curve inclusion test on each point, as described at
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    // This is redundant since the technique involves extending a ray in
    // the x direction (which is what we're doing when we traverse anyway).
    // But as the source points out, the simulation of simplicity technique
    // required to implement the Jordan curve inclusion test is somewhat
    // tricky and I don't feel like thinking about the details of taking
    // advantage of area optimization possibilities.
    var result = [];
    for ( var ty = y_min ; ty <= y_max ; ty++ ) {
      var in_poly = false;
      for ( var tx = x_min ; tx <= x_max ; tx++ ) {
        var tr = false;   // Test result for current point.
        for ( var kk = 0 ; kk < pl ; kk++ ) {
          var va_x = path[kk]['x'];
          var va_y = path[kk]['y'];
          // For the first point, the other end of the line is the last point
          // in the path.
          var vb_x = kk === 0 ? path[pl - 1]['x'] : path[kk - 1]['x'];
          var vb_y = kk === 0 ? path[pl - 1]['y'] : path[kk - 1]['y'];
          if ( ((va_y > ty) != (vb_y > ty))
              && (tx < (vb_x - va_x) * (ty - va_y) / (vb_y - va_y) + va_x) ) {
            tr = ! tr;
          }
        }
        if ( tr && (! in_poly) ) {
          in_poly = true;
          segment = {'y': ty, 'start_x': tx}
        }
        else if ( (! tr) && in_poly ) {
          in_poly = false;
          segment['end_x'] = tx - 1;
          result.push(segment);
        }
      }
    }

    return result;
  }

};
