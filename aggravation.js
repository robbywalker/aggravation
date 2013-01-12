if (Meteor.isClient) {
  var BOARD_SIZE = 500;
  var HOLE_SPACE = BOARD_SIZE * 0.045;
  var HOLE_SIZE = BOARD_SIZE * 0.03;
  var COLORS = ['#333333', '#009922', '#cc3333', '#eeeeee', '#3333cc', '#eeee22'];

  function radians(angle) {
    return angle * Math.PI / 180;
  }

  function holeCenter(angle, radius) {
    return [
      Math.cos(radians(angle)) * radius * HOLE_SPACE + BOARD_SIZE / 2,
      BOARD_SIZE / 2 - Math.sin(radians(angle)) * radius * HOLE_SPACE
    ];
  }
  
  function drawCircle(ctx, x, y, radius, color, width, opt_alpha) {
    ctx.globalAlpha = opt_alpha ? opt_alpha : 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2*Math.PI);
    ctx.stroke();    
  }
  
  Template.board.rendered = function() {
    var i;
    var canvas = this.find('#board');
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    
    var ctx = this.find('#board').getContext('2d');

    for (var group = 0; group < 6; group++) {
      var angle = group * -60;
      var centerFirstLine = holeCenter(90 + angle, 8.5);
      var x, y, offsetX, offsetY;
      
      for (i = 0; i < 22; i++) {
        if (i == 0 || i == 5 || i == 10 || i == 14 || i == 18) {
          if (i == 5) {
            angle -= 90;
          } else if (i == 10) {
            angle += 120;
          } else if (i == 14) {
            angle = group * -60 - 90;
            x = centerFirstLine[0];
            y = centerFirstLine[1];
          } else if (i == 18) {
            angle = group * -60 - 60;
            var c = holeCenter(180 + angle, 11);
            x = c[0];
            y = c[1];
          }
          offsetX = Math.cos(radians(angle)) * HOLE_SPACE;
          offsetY = - Math.sin(radians(angle)) * HOLE_SPACE;
        }
        
        if (i == 0) {
          x = centerFirstLine[0] - offsetX * 2;
          y = centerFirstLine[1] - offsetY * 2;
        } else {
          x += offsetX;
          y += offsetY;
        }
        if (i == 4) {
          drawCircle(ctx, x, y, HOLE_SIZE / 2 + 2, COLORS[group], 3);
        }
        if (i == 14) {
          ctx.lineWidth = HOLE_SPACE;
          ctx.lineCap = 'round';
          ctx.strokeStyle = COLORS[group];
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + offsetX * 3, y + offsetY * 3);
          ctx.stroke();
        }
        if (i >= 18) {
          drawCircle(ctx, x, y, HOLE_SIZE / 2 + 1, COLORS[group], 2, 0.6);
        } else {
          drawCircle(ctx, x, y, HOLE_SIZE / 2, '#000000', 1);
        }
      }
    }
    drawCircle(ctx, BOARD_SIZE / 2, BOARD_SIZE / 2, HOLE_SIZE / 2, '#000000', 1);
  };
  
  Template.board.events({
    'click input' : function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
        console.log("You pressed the button");
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
