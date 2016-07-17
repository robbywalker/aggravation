import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';

import './main.html';
import { Players, Marbles, States } from '../imports/collections.js';

/*
Template.hello.onCreated(function helloOnCreated() {
  // counter starts at 0
  this.counter = new ReactiveVar(0);
});

Template.hello.helpers({
  counter() {
    return Template.instance().counter.get();
  },
});

Template.hello.events({
  'click button'(event, instance) {
    // increment the counter when button is clicked
    instance.counter.set(instance.counter.get() + 1);
  },
});
*/

var BOARD_SIZE = 800;
var HOLE_SPACE = BOARD_SIZE * 0.045;
var HOLE_SIZE = BOARD_SIZE * 0.03;
var DRAW_IDS = false; // for debugging
var COLORS = ['#444444', '#009922', '#cc3333', '#eeeeee', '#3333cc', '#eeee22'];
var COLOR_NAMES = ['black', 'green', 'red', 'white', 'blue', 'yellow'];
var hoverMove = null;
var claimedPlayers = {};

function radians(angle) {
return angle * Math.PI / 180;
}

function getRandomInt(min, max) {
return Math.floor(Math.random() * (max - min + 1)) + min;
}

function holeCenter(angle, radius) {
return [
  Math.cos(radians(angle)) * radius * HOLE_SPACE + BOARD_SIZE / 2,
  BOARD_SIZE / 2 - Math.sin(radians(angle)) * radius * HOLE_SPACE
];
}

function getCurrentState() {
return States.findOne({'key': 'state'});
}

function getCurrentPlayer() {
var state = getCurrentState();
return state && state.player;
}

function getCurrentStateType() {
var state = getCurrentState();
return state && state.kind;
}

function computePositions() {
var result = {};
for (var group = 0; group < 6; group++) {
  var angle = group * -60;
  var centerFirstLine = holeCenter(90 + angle, 8.5);
  var x, y, offsetX, offsetY, id;
  
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
    
    if (i < 14) {
      // normal space
      id = 'N' + (group * 14 + i);
    } else if (i < 18) {
      // home
      id = 'H' + group + (i - 14);
    } else {
      // base
      id = 'B' + group + (i - 18);
    }
    
    if (i == 0) {
      x = centerFirstLine[0] - offsetX * 2;
      y = centerFirstLine[1] - offsetY * 2;
    } else {
      x += offsetX;
      y += offsetY;
    }
    result[id] = [x, y];
  }
}
result['C'] = holeCenter(0, 0);
return result;
}
var POSITIONS = computePositions();

function drawCircle(ctx, pos, radius, color, width, opt_alpha, opt_fill) {
ctx.save();
ctx.globalAlpha = opt_alpha ? opt_alpha : 1;
ctx.beginPath();
ctx.arc(pos[0], pos[1], radius, 0, 2*Math.PI);

if (width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();    
}
if (opt_fill) {
  ctx.fillStyle = opt_fill;
  ctx.fill();
}
ctx.restore();
}

function drawBoard() {
var marbles = getMarbleMap();

var i;
var canvas = document.getElementById('board');
canvas.width = BOARD_SIZE;
canvas.height = BOARD_SIZE;
var ctx = canvas.getContext('2d');
ctx.translate(0, -50);
for (var group = 0; group < 6; group++) {
  drawCircle(ctx, POSITIONS['N' + (group * 14 + 4)], HOLE_SIZE / 2 + 2, COLORS[group], 3);
  
  var homeStart = POSITIONS['H' + group + '0'];
  var homeEnd = POSITIONS['H' + group + '3'];
  ctx.lineWidth = HOLE_SPACE;
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS[group];
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(homeStart[0], homeStart[1]);
  ctx.lineTo(homeEnd[0], homeEnd[1]);
  ctx.stroke();
}
for (var id in POSITIONS) {
  var pos = POSITIONS[id];
  var isBase = id[0] == 'B';
  drawCircle(ctx, pos, HOLE_SIZE / 2 + (isBase ? 1 : 0), isBase ? COLORS[parseInt(id[1])] : '#000000', isBase ? 2 : 1, isBase ? 0.6 : 1);
  if (id in marbles) {
    var lightOffset = HOLE_SIZE / 9;
    drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, COLORS[marbles[id]]);
    var shadow = ctx.createRadialGradient(
        pos[0] - lightOffset, pos[1] - lightOffset, 0,
        pos[0] - lightOffset, pos[1] - lightOffset, HOLE_SIZE / 2);
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadow.addColorStop(0.4, 'rgba(0, 0, 0, 0.05)')
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, shadow);
    var highlight = ctx.createRadialGradient(
        pos[0] - lightOffset, pos[1] - lightOffset, 0,
        pos[0] - lightOffset, pos[1] - lightOffset, HOLE_SIZE / 7)
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, highlight);
  }
  if (DRAW_IDS) {
    ctx.font = '10px Helvetica';
    var m = ctx.measureText(id);
    ctx.fillText(id, pos[0] - m.width / 2, pos[1] + 5);
  }
}
if (hoverMove) {
  var from = POSITIONS[hoverMove[0]];
  var to = POSITIONS[hoverMove[1]];
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'black';
  drawArrow(ctx, from[0], from[1], to[0], to[1], 3, 1);
  ctx.restore();
}
var state = getCurrentState();
var lastMove = state && state.lastMove;
if (lastMove) {
  var parts = lastMove.split(' - ');
  if (parts.length == 2) {
    var from = POSITIONS[parts[0]];
    var to = POSITIONS[parts[1]];
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS[state.lastPlayer];
    ctx.fillStyle = COLORS[state.lastPlayer];
    drawArrow(ctx, from[0], from[1], to[0], to[1], 3, 1);
    ctx.restore();
  }
}
}

function getMarbleMap() {
var map = {};
Marbles.find({}).forEach(function(item) {
  map[item.position] = item.player;
});
return map;
}

function getLegalMoves(marbles, player, roll) {
var result = [];
for (var position in marbles) {
  if (marbles[position] == player) {
    var moves = getLegalMovesForMarble(marbles, position, position, player, roll);
    for (var newPosition in moves) {
      result.push({
        'from': position,
        'to': newPosition
      });
    }
  }
}
return result;
}

function addAll(h1, h2) {
for (var k in h2) {
  h1[k] = h2[k];
}    
}

function isPoint(pos) {
return pos[0] == 'N' && parseInt(pos.substring(1)) % 14 == 9;
}

function getLegalMovesForMarble(marbles, start, current, player, roll) {
var result = {};
if (start != current && marbles[current] == player) {
  return result;
}
if (roll == 0) {
  result[current] = player;
  return result;
}

if (current[0] == 'H' && current[2] != '3') {
  addAll(result, getLegalMovesForMarble(marbles, start, 'H' + player +  '' + (parseInt(current[2]) + 1), player, roll - 1));
        
} else if (current[0] == 'B') {
  if (roll == 1 || roll == 6) {
    var newPos = 'N' + (player * 14 + 4);
    if (marbles[newPos] != player) {
      result[newPos] = player;
    }
  }
} else if (current[0] == 'N') {
  var num = parseInt(current.substring(1));
  
  if (num % 14 == 9) {
    // Point.
    if (isPoint(start) && (((player + 5) % 6) * 14 + 9) != num) {
      // We actually started on the point and this isn't our last point.
      addAll(result, getLegalMovesForMarble(marbles, start, 'N' + ((num + 14) % 84), player, roll - 1));
    }
    if (roll == 1 && (current == start || !isPoint(start))) {
      // Move to center.
      if (marbles['C'] != player) {
        result['C'] = player;
      }
    }
  }
  
  if (num == (player * 14 + 2)) {
    // Turn to home.
    addAll(result, getLegalMovesForMarble(marbles, start, 'H' + player + '0', player, roll - 1));
  } else {
    // Normal move.
    addAll(result, getLegalMovesForMarble(marbles, start, 'N' + ((num + 1) % 84), player, roll - 1));
  }      
} else if (current[0] == 'C') {
  if (roll == 1 && current == start) {
    for (var destGroup = 0; destGroup < 6; destGroup++) {
      var newPos = 'N' + (destGroup * 14 + 9);
      if (marbles[newPos] != player) {
        result[newPos] = player;
      }
    }        
  }
}
return result;
}

Template.board.rendered = function() {
Meteor.autosubscribe(drawBoard);
};

function getPlayers() {
var out = [];
for (var i = 0; i < 6; i++) {
  out.push({'open': true, 'name': COLOR_NAMES[i], 'color': i, 'hex': COLORS[i]});
}
Players.find({}).forEach(function(p) {
  out[p.color] = {'name': p.name, 'color': p.color, 'hex': COLORS[p.color]};
});
return out;    
}

Template.players.players = getPlayers;

Template.players.events({
'click .addPlayer': function(e) {
  e.preventDefault();
  var color = parseInt(e.target.id.split(/(\d+)/)[1]);
  var name = prompt('Enter your name:');
  if (name) {
    claimedPlayers[color] = true;
    Players.insert({'name': name, 'color': color});
    Marbles.insert({'position': 'B' + color + '0', 'player': color});
    Marbles.insert({'position': 'B' + color + '1', 'player': color});
    Marbles.insert({'position': 'B' + color + '2', 'player': color});
    Marbles.insert({'position': 'B' + color + '3', 'player': color});
    if (!getCurrentState()) {
      States.insert({'key': 'state', 'player': color, 'kind': 'waiting'});
    }
  }
},
'click #startOver': function(e) {
  e.preventDefault();
  if (confirm('Are you sure you want to start over?')) {
    reset();
  }
}
});

Template.roll.onRendered(function() {
  this.findAll('.activePlayer').forEach(function(x) {
    x.style.color = COLORS[getCurrentPlayer()];
  });
  hoverMove = null;
  drawBoard();
  var s = this;
  window.setInterval(function() {
    var die = s.find('#die');
    if (getCurrentStateType() == 'rolling') {
      die.className = 'value' + getRandomInt(1, 6);
    } else if (die) {
      die.className = 'value' + Template.roll.dieValue();
    }
  }, 75);
});


Template.roll.dieValue = function() {
var item = States.findOne({'key': 'state'});
return item ? item.die : 1;
};

Template.roll.moves = function() {
if (getCurrentStateType() == 'rolled') {
  var value = Template.roll.dieValue();
  return getLegalMoves(getMarbleMap(), getCurrentPlayer(), value);
} else {
  return [];
}
};

Template.roll.playerCount = function() {
var players = getPlayers();
var count = 0;
for (var i = 0; i < 6; i++) {
  if (!players[i].open) {
    count++;
  }
}
return count;
};

Template.roll.activePlayer = getCurrentPlayer;

Template.roll.activePlayerName = function() {
var players = getPlayers();
var currentPlayer = getCurrentPlayer();
if (currentPlayer in players) {
  return players[currentPlayer].name;      
} else {
  return '';
}
}

Template.roll.isWaiting = function() {
return getCurrentStateType() == 'waiting';
}

Template.roll.isRolled = function() {
return getCurrentStateType() == 'rolled';
}

Template.roll.winner = function() {
var marbles = getMarbleMap();
for (var player = 0; player < 6; player++) {
  for (var h = 0; h < 4; h++) {
    if (!(('H' + player + '' + h) in marbles)) {
      break;
    }
  }
  if (h == 4) {
    return getPlayers()[player].name;
  }
}
}

Template.roll.events({
'click #rollLink': function(e) {
  Meteor.call('states.update', 'state', {'$set': {'kind': 'rolling'}});
  window.setTimeout(function() {
    Meteor.call('states.update', 'state', {'$set': {'kind': 'rolled', 'die': getRandomInt(1, 6)}});
  }, 900);
},
'mouseover .move': function(e) {
  var move = e.target.innerHTML.split(' - ');
  if (move.length == 2) {
    hoverMove = move;
  } else {
    hoverMove = null;
  }
  drawBoard();
},
'mouseout .move': function(e) {
  hoverMove = null;
  drawBoard();
},
'click .move': function(e) {
  var player = getCurrentPlayer();
  var name = getPlayers()[player].name;
  if (!claimedPlayers[player] && !confirm('You have not moved as ' + name + ' yet.  Do you still want to play as ' + name + '?')) {
    return;
  }
  claimedPlayers[player] = true;
  
  hoverMove = null;
  e.preventDefault();
  var moveString = e.target.innerHTML;
  var move = moveString.split(' - ');
  var moved = false;
  if (move.length == 2) {
    var marbles = getMarbleMap();
    if (move[1] in marbles) {
      var openBase;
      var opponent = marbles[move[1]];
      for (openBase = 0; ('B' + opponent + '' + openBase) in marbles; openBase++) {
        // logic in loop condition.
      }
      Meteor.call('marbles.move', move[1], 'B' + opponent + '' + openBase);
    }
    Meteor.call('marbles.move', move[0], move[1]);
    // TODO: handle opponent marble knock off
    moved = true;
  }
  var current = player;
  if (Template.roll.dieValue() != 6 || !moved) {
    var players = getPlayers();
    current = (current + 1) % 6;
    while (players[current].open) {
      current = (current + 1) % 6;
    }
  }
  Meteor.call('states.update', 'state', {'$set': {'kind': 'waiting', 'player': current, 'lastMove': moveString, 'lastPlayer': player}});
}
});

function reset() {
  Meteor.call('game.reset');
}


// Copyright Patrick Horgan patrick at dbp-consulting dot com
// Permission to use granted as long as you keep this notice intact
// use strict is everywhere because some browsers still don't support
// using it once for the whole file and need per method/function
// use.
// Part is derivitive of work by Juan Mendes as noted below as appropriate.
// Some things depend on code in http://dbp-consulting/scripts/utilities.js
var drawLineAngle=function(ctx,x0,y0,angle,length)
{
    ctx.save();
    ctx.moveTo(x0,y0);
    ctx.lineTo(x0+length*Math.cos(angle),y0+length*Math.sin(angle));
    ctx.stroke();
    ctx.restore();
}
      
var drawHead=function(ctx,x0,y0,x1,y1,x2,y2,style)
{
  'use strict';
  // all cases do this.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0,y0);
  ctx.lineTo(x1,y1);
  ctx.lineTo(x2,y2);
  switch(style){
    case 0:
      // curved filled, add the bottom as an arcTo curve and fill
      var backdist=Math.sqrt(((x2-x0)*(x2-x0))+((y2-y0)*(y2-y0)));
      ctx.arcTo(x1,y1,x0,y0,.55*backdist);
      ctx.fill();
      break;
    case 1:
      // straight filled, add the bottom as a line and fill.
      ctx.lineTo(x0,y0);
      ctx.fill();
      break;
    case 2:
      // unfilled head, just stroke.
      ctx.stroke();
      break;
    case 3:
      //filled head, add the bottom as a quadraticCurveTo curve and fill
      var cpx=(x0+x1+x2)/3;
      var cpy=(y0+y1+y2)/3;
      ctx.quadraticCurveTo(cpx,cpy,x0,y0);
      ctx.fill();
      break;
    case 4:
      //filled head, add the bottom as a bezierCurveTo curve and fill
      var cp1x, cp1y, cp2x, cp2y,backdist;
      var shiftamt=5;
      if(x2==x0){
	// Avoid a divide by zero if x2==x0
	backdist=y2-y0;
	cp1x=(x1+x0)/2;
	cp2x=(x1+x0)/2;
	cp1y=y1+backdist/shiftamt;
	cp2y=y1-backdist/shiftamt;
      }else{
	backdist=Math.sqrt(((x2-x0)*(x2-x0))+((y2-y0)*(y2-y0)));
	var xback=(x0+x2)/2;
	var yback=(y0+y2)/2;
	var xmid=(xback+x1)/2;
	var ymid=(yback+y1)/2;

	var m=(y2-y0)/(x2-x0);
	var dx=(backdist/(2*Math.sqrt(m*m+1)))/shiftamt;
	var dy=m*dx;
	cp1x=xmid-dx;
	cp1y=ymid-dy;
	cp2x=xmid+dx;
	cp2y=ymid+dy;
      }

      ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,x0,y0);
      ctx.fill();
      break;
  }
  ctx.restore();
};

var drawArcedArrow=function(ctx,x,y,r,startangle,endangle,anticlockwise,style,which,angle,d)
{
    'use strict';
    style=typeof(style)!='undefined'? style:3;
    which=typeof(which)!='undefined'? which:1; // end point gets arrow
    angle=typeof(angle)!='undefined'? angle:Math.PI/8;
    d    =typeof(d)    !='undefined'? d    :10;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x,y,r,startangle,endangle,anticlockwise);
    ctx.stroke();
    var sx,sy,lineangle,destx,desty;
    ctx.strokeStyle='rgba(0,0,0,0)';	// don't show the shaft
    if(which&1){	    // draw the destination end
	sx=Math.cos(startangle)*r+x;
	sy=Math.sin(startangle)*r+y;
	lineangle=Math.atan2(x-sx,sy-y);
	if(anticlockwise){
	    destx=sx+10*Math.cos(lineangle);
	    desty=sy+10*Math.sin(lineangle);
	}else{
	    destx=sx-10*Math.cos(lineangle);
	    desty=sy-10*Math.sin(lineangle);
	}
	drawArrow(ctx,sx,sy,destx,desty,style,2,angle,d);
    }
    if(which&2){	    // draw the origination end
	sx=Math.cos(endangle)*r+x;
	sy=Math.sin(endangle)*r+y;
	lineangle=Math.atan2(x-sx,sy-y);
	if(anticlockwise){
	    destx=sx-10*Math.cos(lineangle);
	    desty=sy-10*Math.sin(lineangle);
	}else{
	    destx=sx+10*Math.cos(lineangle);
	    desty=sy+10*Math.sin(lineangle);
	}
	drawArrow(ctx,sx,sy,destx,desty,style,2,angle,d);
    }
    ctx.restore();
}

var drawArrow=function(ctx,x1,y1,x2,y2,style,which,angle,d)
{
  'use strict';
  style=typeof(style)!='undefined'? style:3;
  which=typeof(which)!='undefined'? which:1; // end point gets arrow
  angle=typeof(angle)!='undefined'? angle:Math.PI/8;
  d    =typeof(d)    !='undefined'? d    :10;
  // default to using drawHead to draw the head, but if the style
  // argument is a function, use it instead
  var toDrawHead=typeof(style)!='function'?drawHead:style;

  // For ends with arrow we actually want to stop before we get to the arrow
  // so that wide lines won't put a flat end on the arrow.
  //
  var dist=Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
  var ratio=(dist-d/3)/dist;
  var tox, toy,fromx,fromy;
  if(which&1){
    tox=x1+(x2-x1)*ratio;
    toy=y1+(y2-y1)*ratio;
  }else{
    tox=x2;
    toy=y2;
  }
  if(which&2){
    fromx=x1+(x2-x1)*(1-ratio);
    fromy=y1+(y2-y1)*(1-ratio);
  }else{
    fromx=x1;
    fromy=y1;
  }

  // Draw the shaft of the arrow
  ctx.beginPath();
  ctx.moveTo(fromx,fromy);
  ctx.lineTo(tox,toy);
  ctx.stroke();

  // calculate the angle of the line
  var lineangle=Math.atan2(y2-y1,x2-x1);
  // h is the line length of a side of the arrow head
  var h=Math.abs(d/Math.cos(angle));

  if(which&1){	// handle far end arrow head
    var angle1=lineangle+Math.PI+angle;
    var topx=x2+Math.cos(angle1)*h;
    var topy=y2+Math.sin(angle1)*h;
    var angle2=lineangle+Math.PI-angle;
    var botx=x2+Math.cos(angle2)*h;
    var boty=y2+Math.sin(angle2)*h;
    toDrawHead(ctx,topx,topy,x2,y2,botx,boty,style);
  }
  if(which&2){ // handle near end arrow head
    var angle1=lineangle+angle;
    var topx=x1+Math.cos(angle1)*h;
    var topy=y1+Math.sin(angle1)*h;
    var angle2=lineangle-angle;
    var botx=x1+Math.cos(angle2)*h;
    var boty=y1+Math.sin(angle2)*h;
    toDrawHead(ctx,topx,topy,x1,y1,botx,boty,style);
  }
}